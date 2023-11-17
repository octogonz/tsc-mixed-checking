export interface ILoggerOptions {
  newline?: string;
}

export class Logger {
  private _newline: string;

  private constructor(options: ILoggerOptions) {
    this._newline = options.newline || "\n";
  }

  public static create(options: ILoggerOptions): Logger {
    return new Logger(options);
  }

  public log(message: string): void {
    console.log(message + this._newline);
  }
}
