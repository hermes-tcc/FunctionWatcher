import { Router, Request, Response } from "express";
import { Subprocess, StringStream } from "../resources/Subprocess";

const execFunction = async (req: Request) => {
  const proc = new Subprocess(["/", "app", "function", "main"], {
    type: "string",
    input: req.body.input
  });

  proc.start();
  const output = await proc.getOutput();
  const errOutput = await proc.getErrOutput();

  console.log(`Input: ${req.body.input}`)
  console.log(`Program Output: ${output}`);
  console.log(`Program errOutput: ${errOutput}`);
  return output;
};

const executeRoute = Router();

executeRoute.use((req, __, next) => {
  console.log("Execute: ", Date.now());
  next();
});

executeRoute.post("/", async (req: Request, res: Response) => {
  console.log("Req body", req.body);
  const output = await execFunction(req);
  res.status(200).send(output);
});

export { executeRoute };
