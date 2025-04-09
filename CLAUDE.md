# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```
# Build the project
yarn build

# Format code with Prettier
yarn lint

# Run TypeScript files
npx ts-node src/path/to/file.ts

# Run sample scripts
npx ts-node src/samples/deployContract.ts
npx ts-node src/samples/callContract.ts
```

## Code Style Guidelines

- TypeScript with strict typing (`strict: true` in tsconfig.json)
- 2-space indentation, 80-char line length, single quotes
- Use camelCase for variables/functions, PascalCase for types/interfaces
- Group imports: 1) external deps, 2) internal modules, 3) types
- Explicit types for function parameters and return values
- Error handling with descriptive try/catch blocks
- Arrow functions for consistency
- Constants defined in src/utils/constants.ts
- Use ethers v5 as primary and ethers v6 as 'ethers-v6' when needed
