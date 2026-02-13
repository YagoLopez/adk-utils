# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [0.2.5](https://github.com/YagoLopez/adk-utils/compare/v0.2.4...v0.2.5) (2026-02-13)

### [0.2.4](https://github.com/YagoLopez/adk-utils/compare/v0.2.3...v0.2.4) (2026-02-11)

### [0.2.3](https://github.com/YagoLopez/adk-utils/compare/v0.2.2...v0.2.3) (2026-02-11)

### [0.2.2](https://github.com/YagoLopez/adk-utils/compare/v0.2.1...v0.2.2) (2026-02-11)

### 0.2.1 (2026-02-06)

## 0.2.0 (2026-02-05)


### ⚠ BREAKING CHANGES

* removed `genai-agent-service` and `ollama-model` implementations. These modules are no longer maintained or utilized in the application.

* chore(deps): update devDependencies in package-lock.json

* chore(adk-utils): update dependencies and add npm/gitignore files

* chore: add .npmrc and update .gitignore

* feat(dependencies): add standard-version and changelog tooling dependencies

* chore(release): 0.1.0

* docs(adk-utils): update README with detailed usage examples

This update improves the README by adding comprehensive usage instructions for `OllamaModel` and `GenAIAgentService`, enhancing setup clarity for local and cloud-hosted environments. Also includes project structure, testing, and documentation notes.

* chore(release): 0.1.1

* chore: untrack .npmrc file to prevent token leakage

* docs(adk-utils): fix typos and improve code snippets in README
* removed `zod-to-json-schema` dependency and updated tool handling logic to enforce stricter adherence to `BaseTool` and `GenAI` types.

* refactor(api): improve tool integration with stricter typings
* removed `zod-to-json-schema` dependency and updated tool handling logic to enforce stricter adherence to `BaseTool` and `GenAI` types.

### Features

* **adk-utils:** add eslint config and update dependencies ([3edf835](https://github.com/YagoLopez/starter-nextjs-adk-js-2/commit/3edf835bc49285a2b987a029acd950a4564fc325))


* create-npm-package (#9) ([2b2005b](https://github.com/YagoLopez/starter-nextjs-adk-js-2/commit/2b2005b52f574e94db262d48b64ffc3e6bc4fbc9)), closes [#9](https://github.com/YagoLopez/starter-nextjs-adk-js-2/issues/9)
* use-ollama-cloud-and-local-2-sonnet-refactor-api-route (#6) ([e2fe5f2](https://github.com/YagoLopez/starter-nextjs-adk-js-2/commit/e2fe5f28b6701041720370f4ab5d148b3183060e)), closes [#6](https://github.com/YagoLopez/starter-nextjs-adk-js-2/issues/6)

### [0.1.1](https://github.com/YagoLopez/starter-nextjs-adk-js-2/compare/v0.1.0...v0.1.1) (2026-02-05)

## 0.1.0 (2026-02-05)


### ⚠ BREAKING CHANGES

* **app:** removed `genai-agent-service` and `ollama-model` implementations. These modules are no longer maintained or utilized in the application.
* removed `zod-to-json-schema` dependency and updated tool handling logic to enforce stricter adherence to `BaseTool` and `GenAI` types.

* refactor(api): improve tool integration with stricter typings
* removed `zod-to-json-schema` dependency and updated tool handling logic to enforce stricter adherence to `BaseTool` and `GenAI` types.

### Features

* **dependencies:** add standard-version and changelog tooling dependencies ([2b2f879](https://github.com/YagoLopez/starter-nextjs-adk-js-2/commit/2b2f879c35683664f0e1447b5b75afac9cad760a))


* use-ollama-cloud-and-local-2-sonnet-refactor-api-route (#6) ([e2fe5f2](https://github.com/YagoLopez/starter-nextjs-adk-js-2/commit/e2fe5f28b6701041720370f4ab5d148b3183060e)), closes [#6](https://github.com/YagoLopez/starter-nextjs-adk-js-2/issues/6)
* **app:** remove unused service and model files ([1e32d86](https://github.com/YagoLopez/starter-nextjs-adk-js-2/commit/1e32d86fd591eab4d4d0213326408461b9bd37d2))
