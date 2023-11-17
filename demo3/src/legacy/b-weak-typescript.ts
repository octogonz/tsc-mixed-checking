import { Logger } from "../a-best-practices";

export function nonstrictFunction(message: string): void {
  // This error appears only with "strict: true" in tsconfig.json:
  //
  // TS2322: Type 'null' is not assignable to type 'string | undefined'.
  const logger = Logger.create({ newline: null });
  logger.log(message);
}
