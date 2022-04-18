import * as yaml from 'js-yaml';
import { parse, CommandEntry } from 'docker-file-parser';
import fs from 'fs';
// import readline from 'readline';
const readline = require('readline');

const options = { includeComments: true };
const imgRegistry = process.env.GOLDEN_DTR || 'docker';

export async function findRemoteRef(refs: Array<string>, branch: string) { 
  const ref = `refs/remotes/origin/${branch}`;
  if (refs.includes(ref) == true) {
    throw new Error(`Ref ${branch} is already present on remote`);
  } else {
    return 1;
  }
}

export function parseYaml(yamlObj: any) {
  const obj = yaml.load(yamlObj);
  return obj;
}

export function getRepos(configObj: any) {
  if (configObj.repos)
    return configObj.repos;
  else
    throw new Error('No repos object found');
}

export function getImageFromRaw(rawString: string, imageRegistryArgName: string): string {
  return rawString
    .split(' ')
    .filter(str => str.includes(imageRegistryArgName) || str.includes(imgRegistry))
    .reduce((p, c) => c);
}

export function createNewRaw(rawPrevious: string, newImg: string): string {
  const img = getImageFromRaw(rawPrevious, "docker");
  return rawPrevious
    .split(' ')
    .map(ele => { 
      if (ele == img) return newImg 
      else return ele 
    })
    .join(" ");
}

export function getLayerFromDockerfile(parsedDockerFile: Array<CommandEntry>, layer: string): CommandEntry{
  const dockerLayer = parsedDockerFile 
    .filter(cmd => cmd.name == "FROM")
    .filter(cmd => cmd.raw.includes(layer))
    .reduce((p, c) => c);

  return dockerLayer;
}

export async function processLineByLine(dir, version, layer: string) {
  const dockerfile = fs.readFileSync(dir + "/Dockerfile", "utf8");
  const commands = parse(dockerfile, options);
  const buildLayer = getLayerFromDockerfile(commands, layer);
  const fileStream = fs.createReadStream(dir + '/Dockerfile', "utf8");
  const writeStream = fs.createWriteStream(dir + '/newDockerfile', 'utf8');

  const dockerReadStream = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  // Note: we use the crlfDelay option to recognize all instances of CR LF
  // ('\r\n') in input.txt as a single line break.
  let lineno = 1;
  let returnValue = 1;

  for await (const line of dockerReadStream) {

    if (lineno == buildLayer.lineno ) {

      const previousImg = getImageFromRaw(buildLayer.raw, "docker");
      const newImg      = version;

      if (previousImg != newImg) {

        const newRaw = createNewRaw(buildLayer.raw, newImg);
        writeStream.write(newRaw + "\n");

      } else {
        // We don't want to throw here, because we need to finish rebuilding the dockerfile.
        //   This ensures we don't accidentally trigger a git diff/change.
        returnValue = 0;
        writeStream.write(line + "\n");
      }
    } else {
      writeStream.write(line + "\n");
    }
    lineno++;

  }

  return returnValue;
}

