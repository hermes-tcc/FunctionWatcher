import { spawn } from "child_process";
import { Stream, Readable } from "stream";
import Path from "path";

class StringStream extends Stream.Readable {
  str: string;

  constructor(str: string, options?: any) {
    super(options);
    this.str = str;
  }

  _read() {
    this.push(this.str);
    this.push(null);
  }
}

class Subprocess {
  filePath: string;
  process: any;
  resolveReturnCode: any;
  returnCode: Promise<number>;
  exited: boolean;
  output: string;
  errOutput: string;
  inputObj: any;

  constructor(pathArr: string[], inputObj: any) {
    this.filePath = Path.join(...pathArr);
    this.inputObj = inputObj;
    this.returnCode = new Promise(resolve => {
      this.resolveReturnCode = resolve;
    });

    this.output = "";
    this.errOutput = "";
  }

  getInputStream(): Readable {
    if (this.inputObj.type == "string")
      return new StringStream(this.inputObj.input);

    throw new Error(
      `Input type not supported, undefined or invalid: ${this.inputObj.type}`
    );
  }

  start() {
    this.process = spawn(this.filePath);
    console.log("Proess", this.filePath);

    this.process.on("close", (ret: number) => {
      this.resolveReturnCode(ret);
      this.exited = true;
    });
    this.process.on("error", (err: any) => console.log("Error catch", err));
    this.process.stdout.on("data", (data: string) => (this.output += data));
    this.process.stderr.on("data", (data: string) => (this.errOutput += data));

    this.getInputStream()
      .pipe(this.process.stdin)
      .on("error", (e: any) => {
        console.log("PIPE ERROR CAPTURED", e);
      });
  }

  getOutput = async () => {
    await this.returnCode;
    return this.output;
  };

  getErrOutput = async () => {
    await this.returnCode;
    return this.errOutput;
  };

  kill() {}
}

export { Subprocess, StringStream };
