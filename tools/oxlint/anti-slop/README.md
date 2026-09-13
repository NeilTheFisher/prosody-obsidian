# anti-slop (vendored)

Copy of [dmmulroy/anti-slop](https://github.com/dmmulroy/anti-slop) `src/` at commit `c44ef22`,
produced by upstream's install script and then trimmed:

```bash
node <anti-slop-checkout>/skills/install-anti-slop/scripts/install.mjs --force
```

Upstream ships 18 rules. Only the 15 enabled in `.oxlintrc.json` are kept — `index.ts` is
rewritten to import just those and the other 3 rule files are deleted. `.oxlintrc.json` records
which 3 are off and why. To enable one, re-run the install script and re-trim. The opt-in
`src/effect/` plugin is skipped: this repo has no direct Effect dependency.

The kept rules and `shared/*.ts` are byte-identical to upstream, so don't
hand-edit them; that is what keeps the next upstream diff readable. They are excluded from
`bun fmt`, oxlint, Biome, and knip for the same reason.

It has to be vendored rather than installed: oxlint loads JS plugins under Node, and Node
refuses to strip TypeScript types for files under `node_modules`, so the package's raw
`./src/index.ts` export can never load from a dependency. (The npm name
`oxlint-plugin-anti-slop` is an unrelated squat, not upstream.)
