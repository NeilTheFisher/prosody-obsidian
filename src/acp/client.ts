import { Platform } from "obsidian";
import type {
  Agent,
  PermissionMode,
  PermissionRequestParams,
  ProsodySettings,
  SessionUpdateParams,
} from "../types.ts";
import { isRemote, winToWsl } from "../util.ts";

interface AcpClientOptions {
  permissionMode: PermissionMode;
  debug: boolean;
  onUpdate?: (params: SessionUpdateParams) => void;
}

interface PendingCall {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
}

type Outbound =
  | { jsonrpc: "2.0"; id: number; method: string; params?: unknown }
  | { jsonrpc: "2.0"; method: string; params?: unknown }
  | { jsonrpc: "2.0"; id: number; result: unknown }
  | { jsonrpc: "2.0"; id: number; error: { code: number; message: string } };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toError(value: unknown): Error {
  if (isRecord(value)) {
    const message = value["message"];

    if (typeof message === "string") return new Error(message);
  }

  return new Error(typeof value === "string" ? value : "Agent error");
}

export class AcpClient {
  private permissionMode: PermissionMode;
  private debug: boolean;
  private onUpdate?: (params: SessionUpdateParams) => void;
  private pending = new Map<number, PendingCall>();
  private nextId = 1;
  private buffer = "";
  private socket: WebSocket | null = null;
  private process: ReturnType<typeof import("child_process").spawn> | null = null;

  constructor(options: AcpClientOptions) {
    this.permissionMode = options.permissionMode;
    this.debug = options.debug;
    this.onUpdate = options.onUpdate;
  }

  private log(message: string): void {
    if (this.debug) console.log("[prosody] " + message);
  }

  connect(agent: Agent, settings: ProsodySettings, cwd: string): Promise<void> {
    if (isRemote(agent)) return this.connectWebSocket(agent.command);

    return this.connectStdio(agent, settings, cwd);
  }

  private connectWebSocket(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      let socket: WebSocket;

      try {
        socket = new WebSocket(url);
      } catch {
        reject(new Error("Invalid WebSocket URL: " + url));

        return;
      }

      this.socket = socket;
      socket.binaryType = "arraybuffer";

      const timer = setTimeout(() => {
        reject(new Error("WebSocket connection timed out"));
      }, 20000);

      socket.onopen = () => {
        clearTimeout(timer);
        resolve();
      };

      socket.onerror = () => {
        clearTimeout(timer);
        reject(new Error("WebSocket error: " + url));
      };

      socket.onmessage = async (event) => {
        const data: unknown = event.data;

        if (typeof data === "string") this.receive(data);
        else if (data instanceof ArrayBuffer) this.receive(new TextDecoder().decode(data));
        else if (data instanceof Blob) this.receive(await data.text());
      };
    });
  }

  private connectStdio(agent: Agent, settings: ProsodySettings, cwd: string): Promise<void> {
    if (!Platform.isDesktopApp) {
      return Promise.reject(
        new Error("Local agents need the desktop app. Use a ws:// agent URL on mobile."),
      );
    }

    const { spawn } = require("child_process") as typeof import("child_process");
    const useWsl = Platform.isWin && settings.windowsWslMode;
    const command = useWsl ? "wsl.exe" : agent.command;

    const args = useWsl
      ? [
          ...(settings.wslDistribution ? ["-d", settings.wslDistribution] : []),
          "--cd",
          winToWsl(cwd) || "/",
          "--",
          agent.command,
          ...agent.args,
        ]
      : agent.args;

    this.log(`spawn ${command} ${args.join(" ")}`);
    this.process = spawn(command, args, {
      cwd: useWsl ? undefined : cwd || undefined,
      env: {
        ...process.env,
        ...Object.fromEntries(agent.env.map((pair) => [pair.key, pair.value])),
      },
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.process.stdout?.on("data", (data: Buffer) => {
      this.receive(data.toString());
    });
    this.process.stderr?.on("data", (data: Buffer) => {
      this.log("[stderr] " + data.toString().trim());
    });
    this.process.on("exit", () => {
      for (const pending of this.pending.values())
        pending.reject(new Error("Agent process exited"));
      this.pending.clear();
    });

    return Promise.resolve();
  }

  private receive(chunk: string): void {
    this.buffer += chunk;
    let index = this.buffer.indexOf("\n");

    while (index >= 0) {
      const line = this.buffer.slice(0, index).trim();
      this.buffer = this.buffer.slice(index + 1);

      if (line) {
        try {
          this.handle(JSON.parse(line));
        } catch {
          this.log("non-json line: " + line.slice(0, 200));
        }
      }

      index = this.buffer.indexOf("\n");
    }
  }

  private write(message: Outbound): void {
    const payload = JSON.stringify(message) + "\n";

    if (this.socket) this.socket.send(payload);
    else this.process?.stdin?.write(payload);
  }

  private handle(raw: unknown): void {
    if (!isRecord(raw)) return;
    const id = raw["id"];
    const method = raw["method"];

    if (typeof id === "number" && ("result" in raw || "error" in raw)) {
      this.settle(id, raw["result"], raw["error"]);

      return;
    }

    if (method === "session/update") {
      this.onUpdate?.(raw["params"] as SessionUpdateParams);

      return;
    }

    if (method === "session/request_permission") {
      this.respondToPermission(id, raw["params"] as PermissionRequestParams);

      return;
    }

    if (typeof id === "number") {
      this.write({ jsonrpc: "2.0", id, error: { code: -32601, message: "Method not supported" } });
    }
  }

  private settle(id: number, result: unknown, error: unknown): void {
    const pending = this.pending.get(id);

    if (!pending) return;
    this.pending.delete(id);

    if (error === undefined) pending.resolve(result);
    else pending.reject(toError(error));
  }

  private respondToPermission(id: unknown, params: PermissionRequestParams): void {
    const options = params.options ?? [];
    const wanted = this.permissionMode === "allow" ? "allow" : "reject";

    const option =
      options.find((candidate) => (candidate.kind ?? "").startsWith(wanted)) ??
      (this.permissionMode === "allow" ? options[0] : undefined);

    const result = option
      ? { outcome: { outcome: "selected", optionId: option.optionId } }
      : { outcome: { outcome: "cancelled" } };

    if (typeof id === "number") this.write({ jsonrpc: "2.0", id, result });
  }

  request<T>(method: string, params?: unknown): Promise<T> {
    const id = this.nextId++;
    this.write({ jsonrpc: "2.0", id, method, params });

    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: (value) => {
          resolve(value as T);
        },
        reject,
      });
    });
  }

  close(): void {
    try {
      this.socket?.close();
    } catch {
      /* ignore */
    }

    try {
      this.process?.kill();
    } catch {
      /* ignore */
    }
  }
}
