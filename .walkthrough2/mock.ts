import { startMockOpenAi } from "../tests/mock-openai";
const port = Number(process.env.E2E_MOCK_PORT ?? 8899);
startMockOpenAi(port);
console.log(`mock openai on ${port}`);
