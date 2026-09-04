# Release — macOS package & signing

IM Review ships as a **Tauri 2** desktop app. Primary target: **macOS** (`.app` + `.dmg`).

## Quick local build (unsigned / ad-hoc)

No Apple Developer certificate required. Gatekeeper will warn on other machines until you sign + notarize.

```bash
pnpm install
pnpm tauri build
```

Artifacts:

| Path                                                  | Contents             |
| ----------------------------------------------------- | -------------------- |
| `src-tauri/target/release/bundle/macos/IM Review.app` | App bundle           |
| `src-tauri/target/release/bundle/dmg/*.dmg`           | Disk image installer |

`tauri.conf.json` sets `bundle.macOS.signingIdentity` to `"-"` (ad-hoc). Override with a real identity via env (see below).

## Signed + notarized build (distribution)

Needs an **Apple Developer Program** membership and a **Developer ID Application** certificate.

1. Install the certificate in Keychain Access.
2. Confirm identity:

   ```bash
   security find-identity -v -p codesigning
   ```

3. Export env vars, then build:

   ```bash
   export APPLE_SIGNING_IDENTITY="Developer ID Application: Your Name (TEAMID)"
   export APPLE_ID="you@example.com"
   export APPLE_PASSWORD="app-specific-password"   # appleid.apple.com → App-Specific Passwords
   export APPLE_TEAM_ID="TEAMID"

   pnpm tauri build
   ```

Tauri signs with the identity, uses `src-tauri/Entitlements.plist` (JIT / network for WebView), and notarizes when Apple credentials are set.

4. Verify:

   ```bash
   codesign --verify --deep --strict --verbose=2 \
     "src-tauri/target/release/bundle/macos/IM Review.app"
   spctl --assess --type execute -vv \
     "src-tauri/target/release/bundle/macos/IM Review.app"
   ```

## GitHub Actions

Workflow: [`.github/workflows/release.yml`](../.github/workflows/release.yml).

Required repository secrets for macOS signing/notarization:

| Secret                       | Purpose                                        |
| ---------------------------- | ---------------------------------------------- |
| `APPLE_CERTIFICATE`          | Base64 `.p12` of Developer ID Application cert |
| `APPLE_CERTIFICATE_PASSWORD` | Password for the `.p12`                        |
| `APPLE_SIGNING_IDENTITY`     | Full identity string from Keychain             |
| `APPLE_ID`                   | Apple ID email                                 |
| `APPLE_PASSWORD`             | App-specific password                          |
| `APPLE_TEAM_ID`              | 10-character Team ID                           |

Trigger: push a tag `v*` (e.g. `v0.1.0`) or run the workflow manually.

### Recommended: one command from local

Working tree must be clean and you must be on `main`/`master`.

```bash
pnpm release:patch   # 0.1.0 → 0.1.1
pnpm release:minor   # 0.1.0 → 0.2.0
pnpm release:major   # 0.1.0 → 1.0.0

# preview only
pnpm release:patch -- --dry-run

# bump + tag locally, do not push
pnpm release:patch -- --no-push
```

The script updates:

- `package.json`
- `src-tauri/tauri.conf.json`
- `src-tauri/Cargo.toml` (+ `Cargo.lock` when present)

Then commits `chore(release): vX.Y.Z`, creates annotated tag `vX.Y.Z`, and pushes branch + tag.

### Manual tag

```bash
# after pushing main/master
git tag -a v0.1.0 -m "Release v0.1.0"
git push origin v0.1.0
```

GitHub Actions → **Release** builds macOS `.app` + `.dmg` and attaches them to a published GitHub Release.

Without Apple secrets, the workflow still builds an **ad-hoc** macOS artifact (useful for smoke tests).

## Coverage (Coveralls)

Frontend Vitest coverage uploads on every CI run (`pnpm test:coverage` → `coverage/lcov.info`).

Rust currently has a small unit-test suite + `cargo clippy` in CI, but **no Coveralls rust job yet** (needs more tests + `cargo-llvm-cov`). The Coveralls badge reflects **frontend** coverage.

## Version bump

Keep these in sync when cutting a release:

- `package.json` → `version`
- `src-tauri/tauri.conf.json` → `version`
- `src-tauri/Cargo.toml` → `version`

## License

Distributed under the [MIT License](../LICENSE).
