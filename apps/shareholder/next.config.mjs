import path from "node:path";
const config={output:"standalone",outputFileTracingRoot:path.resolve(process.cwd(),"../.."),transpilePackages:["@tto/ui"]};
export default config;
