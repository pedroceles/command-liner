---
name: hello
description: Smoke-test plugin to confirm the liner plugin system is working.
---

# hello

A trivial plugin for verifying that `liner` discovered and registered plugins correctly.

## Commands

- `liner hello greet [name]` — prints a greeting. Defaults to `world`.

## Examples

```sh
liner hello greet                       # JSON: {"message":"Hello, world!"}
liner hello greet Pedro
liner hello greet Pedro --no-json       # human: Hello, Pedro!
```
