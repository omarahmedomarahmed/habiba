import { startMockOpenAi } from "./tests/mock-openai";
const { server } = startMockOpenAi(8899);
process.on("SIGTERM", () => server.close());
console.log("mock openai on 8899");
