# ts-mixed-checking-sample

This repo illustrates a couple alternative approaches for incrementally migrating legacy source files
to adopt a stricter `tsconfig.json` configuration for TypeScript.

## How to build the demos

Each project folder (`demo1`, `demo2,` `demo3`) is built using the same shell commands:

```bash
# Step 1. Get PNPM from https://pnpm.io/

# Step 2. Enter the project folder
cd demo1

# Step 3. Install the dependencies
pnpm install

# Step 4. Compile the code
# NOTE: For "demo1" only, this step is expected to print compile errors; the output is still usable.
pnpm build

# Step 5. Run the compiled application.  It should print the string "123", with no error messages.
pnpm start
```

## demo1: Problem setup

The [demo1](./demo1/) folder has 4 files with different levels of TypeScript maturity:

- [a-best-practices.ts](./demo1/src/a-best-practices.ts): The ideal good state; this file compiles without errors when **tsconfig.json** has `strict: true`
- [b-weak-typescript.ts](./demo1/src/b-weak-typescript.ts): A "legacy" source file that compiles without errors only when using an older **tsconfig.json** that is missing the latest strict checks.
- [c-never-checked-typescript.ts](./demo1/src/c-never-checked-typescript.ts): A source file that was shamefully developed without any CI pipeline to invoke the TypeScript compiler to enforce type checking. As a result the code does not compile, although the .js output runs correctly.
- [d-plain-javascript.js](./demo1/src/d-plain-javascript.js): An ancient source file that was written using unsafe JavaScript, and has not been converted to TypeScript yet.  We can import it using the [allowJs](https://www.typescriptlang.org/tsconfig#allowJs) setting in **tsconfig.json**.

The `import` statements in these files meet the dependency criteria that better levels never import worse levels:
- `D` imports `C`
- `C` imports `B`
- `B` imports `A`

This criteria greatly simplifies the task of migrating everything to state `A`.  For example, if  `a-best-practices.ts` were to import from `b-weak-typescript.ts`, that could cause problems: If `A` declares types that inherit/embed types from `B`, the resulting types may be messy.

**Problem statement:** The `demo1` project fails to compile.  `c-never-checked-typescript.ts` has compile errors, and strict settings for `a-best-practices.ts` cannot be enabled without breaking `b-weak-typescript.ts`.

## demo2: Possible solution using side-by-side tsconfig files

The [demo2](./demo2/) project illustrates an approach of using two configurations side by side:

- [demo2/tsconfig.json](./demo2/tsconfig.json) performs validation only, using [noEmit: true](https://www.typescriptlang.org/tsconfig#noEmit). It processes only the file `a-best-practices.ts`, ignoring the other files.  `allowJs` is false.
- [demo2/tsconfig.legacy.json](./demo2/tsconfig.json) performs the full build, setting `noEmit: false` to produce the outputs, and using `allowJs` to accept `d-plain-javascript.js`.
- The `package.json` build command is `tsc && tsc --project tsconfig.legacy.json`, invoking the compiler twice.
- For this approach, the errors in `c-never-checked-typescript.ts` are suppressed using `// @ts-nocheck` at the top of that file.  This comment should eventually be removed as files are migrated to a better state.

The engineering tradeoff for this approach is speed, since the files referenced by `tsconfig.json` must get type-checked twice.

## demo3: Possible solution using tsconfig references

The [demo3](./demo3/) project illustrates an approach using TypeScript's [project references](https://www.typescriptlang.org/docs/handbook/project-references.html) feature.

- [demo3/tsconfig.json](./demo3/tsconfig.json) compiles `a-best-practices.ts` with strict settings.
- [demo3/tsconfig.legacy.json](./demo3/tsconfig.json) compiles the remaining files using the lax settings.  The `tsconfig.legacy.json` references `tsconfig.json` as a dependency.
- The `package.json` build command is `tsc --build tsconfig.legacy.json`, invoking the compiler once in multi-project [build mode](https://www.typescriptlang.org/docs/handbook/project-references.html#build-mode-for-typescript).
- This mode requires `"composite": true` in the referenced project `tsconfig.json`, which turns on the incremental build cache; as a result, our build script must clear the cache using `rimraf -g *.tsbuildinfo` to guarantee a correct result.
- For this approach, the errors in `c-never-checked-typescript.ts` are suppressed using `// @ts-nocheck` at the top of that file.  This comment should eventually be removed as files are migrated to a better state.

The project references feature requires the `outDir` to be different for `tsconfig.json` and `tsconfig.legacy.json`, which requires some thought to ensure `import`/`require()` paths are correctly remapped from `src/thing.ts` (in .ts files) to the corresponding `lib/thing.js` (in the emitted .js files).  I have solved it using a subdirectory (`"outDir": "lib"` and `"outDir": "lib/legacy"`), so that legacy files can import new files using `../` paths which will resolve correctly in the `lib` folder. This avoids clumsy path mappings in `tsconfig.legacy.json`, but it requires some care to ensure that `tsconfig.json`'s `"includes"` globs do not accidentally include files from `src/legacy`.

The engineering tradeoff for this approach is increased complexity.  Also, many engineers are unfamiliar with project references, as it is a relatively new feature with somewhat limited usefulness. (On the surface, project references looks like a great solution for building monorepos, however it assumes that every project is using the same version of the TypeScript compiler, and it provides no story for invoking other build tasks such as preprocessors, postprocessors, bundlers, test runners, etc.)
