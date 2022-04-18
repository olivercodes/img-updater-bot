import { parseYaml, getRepos, getLayerFromDockerfile, processLineByLine } from './helpers';
import * as path from 'path';
import * as fs from 'fs';
import { parse } from 'docker-file-parser';
import { CommandEntry } from 'docker-file-parser';
import { resolveConfig, parseConfigmap } from './k8s_helpers';
const githubWorkspace = path.join(__dirname, '../test_files');
import { V1ConfigMap } from '@kubernetes/client-node';


describe('config parsing', () => {

  const validRepoConifg = {
    repos: [
      "some/repo"
    ]
  }
});

describe('dockerfile parsing', () => {
  it('should fail when there is no repos object', () => {
    expect(() => { 
      getRepos({}) 
    }).toThrowError();
  });

  it('should get the layer from the dockerfile', () => {
    const localDocker = fs.readFileSync(githubWorkspace + '/Dockerfile', 'utf8');
    const parsedDocker: Array<CommandEntry>  = parse(localDocker);
    const layer = getLayerFromDockerfile(parsedDocker, 'production');
    const testLayer = {"args": "docker.io/alpine:latest as production-stage", "lineno": 8, "name": "FROM", "raw": "FROM docker.io/alpine:latest as production-stage"};
    expect(layer).toEqual(testLayer);
  });

  it('should throw an error', () => {
    const localDocker = fs.readFileSync(githubWorkspace + '/Dockerfile', 'utf8');
    const parsedDocker: Array<CommandEntry>  = parse(localDocker);
    expect(() => {
      const l = getLayerFromDockerfile(parsedDocker, 'dev');
    }).toThrowError();
  });
});


describe('dockerfile tests', () => {
  fs.copyFileSync(githubWorkspace + "/Dockerfile", githubWorkspace + "/newDockerfile");
  const dockerfile = fs.readFileSync(githubWorkspace + "/newDockerfile", "utf8");
  const options = { includeComments: true };
  const commands = parse(dockerfile, options);

  it('should update the dockerfile', async () => {
    const githubWorkspace = path.join(__dirname, '../test_files');
    const newImg      = "$IMG_URL_ARG/1234";
    const layer = 'production';
    const productionLayer = getLayerFromDockerfile(commands, layer);
    const p = await processLineByLine(githubWorkspace, newImg, layer);

    expect(p).toEqual(1);
  });
});



