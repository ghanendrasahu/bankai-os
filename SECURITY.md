# Security Lab Configuration

Bankai OS ships a security harness for testing **targets you own or are authorized
to test**. The scope is deliberate and explicit, not a rule that nags mid-test:
within one declaration, the agent may scan, fuzz and brute-force as aggressively
as the lab requires - no confirmations, no rate limits.

## Configure the scope (once)

`LAB_CIDR` environment variable, or the `lab.cidr` setting row (Settings API),
comma separated:

```
LAB_CIDR=192.168.1.0/24,10.0.0.0/8
```

Loopback (`localhost`, `127.0.0.0/8`, `::1`) and `*.lab` hostnames are always
allowed. Adding a public range to `LAB_CIDR` is your explicit authorization of
that range - expect most programs to require permission and written scope.

Optional: `LAB_WORKSPACE` overrides the report/output root
(default `<cwd>/security/<agentId>`; gitignored).

## What enforces what

| Layer | Enforcement |
|---|---|
| `port_scan`, `http_request` | Targets (after DNS resolution) must fall inside the lab scope - enforced in the tool layer |
| `run_command` | General command execution on the host, no target policing (arbitrary commands cannot be reliably meaning-scoped); used by the lab agent per its prompt and your judgment |
| Runs & events | Every tool call, argument and output is already logged in SQLite for review |
| Agent allowlists | Each agent only receives the tools listed for it |

The `Recon` agent is seeded at boot with the full lab toolkit.

## Android lab devices (phones/tablets)

Owned Android devices on the LAN count as lab targets (they sit inside the
declared scope or resolve to it). The Android Debug Bridge is installed and on
`PATH` for `run_command`:

```
adb devices            # connected phones (USB debugging must be on, and the
adb shell pm list pkg  #   phone's on-screen Allow prompt accepted once)
adb shell screencap    # installed packages, screenshots, logcat, etc.
```

The one-time unlock lives on the phone itself: Settings > About phone > tap
Build number 7x, then Developer options > USB debugging. Phones also
randomize their Wi-Fi MAC, so re-scan (`nmap -sn <lab-cidr>`) after every
reconnect.
