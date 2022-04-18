import to from 'await-to-js';
import fs     from 'fs';
import path   from 'path';
import { Clone, Repository, Signature } from 'nodegit';
import rimraf from 'rimraf';
import { findRemoteRef, processLineByLine, parseYaml, getRepos } from './lib/helpers';
import { resolvePolicy, resolveConfig } from './lib/k8s_helpers';
const dname = __dirname;
const terminateMessage = "Program will now terminate.";

if (!process.env.KUBECONFIG) {
  console.error(`Error, environment variable KUBECONFIG not found. ${terminateMessage}`);
  process.exit();
}

if (!process.env.POLICY_NAME) {
  console.error(`Error, environment variable POLICY_NAME not found. ${terminateMessage}`);
  process.exit();
}

if (!process.env.GIT_URL) {
  console.error(`Error, environment variable GIT_URL not found. ${terminateMessage}`);
  process.exit();
}

if (!process.env.CONFIG_NAME) {
  console.error(`Error, environment variable CONFIG_NAME not found. ${terminateMessage}`);
  process.exit();
}

/////////////
// Setup our config before control loop gets started. 
/////////////
const git_url = process.env.GIT_URL;            
const policyName = process.env.POLICY_NAME;     // node-16-prod-image-policy
const configFileName = process.env.CONFIG_NAME; // image-updater-config

(async () => {

  const [err, config] = await to(resolveConfig(configFileName, 'flux-system'));

  if (err) {
    console.error(err)
    console.error('Program will now terminate...');
    process.exit();
  }

  // const config = await resolveConfig(configFileName, 'flux-system');
  const parsedYaml = parseYaml(config);
  const repos: Array<string> = getRepos(parsedYaml);

  const [errImgResolve, resolvedImageUrl] = await to( resolvePolicy(policyName, 'flux-system') );
  if (errImgResolve) {
    console.error('Failed to resolve image from policy', errImgResolve);  
    return;
  }

  const imageTag = resolvedImageUrl.split(":")[1]; 
  console.log(`Policy ${policyName} will be evaluated....`);
  console.log(`Current ${policyName} resolves to.... ${imageTag}`);
  console.log(`Full url... ${resolvedImageUrl}`);
  console.log(`The following repos are to be evaluated:`);
  console.log(repos[policyName]);

  repos[policyName].forEach(async (repoName) => {


    const repoTmpLocation = path.join(dname, "/tmp" + repoName);
    // Make sure the tmp is empty
    rimraf.sync(repoTmpLocation);

    const [repoCloneError, clonedRepo] = await to( Clone.clone(git_url + "/" + repoName, repoTmpLocation) );
    if (repoCloneError) {
      console.error('Failed to clone the repo: ', repoCloneError);
      return; // Exit current iteration
    }

    const [repoOpenErr, repo] = await to(Repository.open(clonedRepo.workdir()));
    if (repoCloneError) {
      console.error(`Failed to open repository ${clonedRepo.workdir()}`); 
      return; // Exit current iteration
    }

    const [dockerProcessErr, processedDockerfile] = await to(processLineByLine(path.resolve(repo.workdir()), resolvedImageUrl, 'production'));
    if (processedDockerfile == 0) {
      console.info(`${repoName} - already up to date with latest image ${resolvedImageUrl}`);
      return;
    }
    if (dockerProcessErr) {
      console.info(`${repoName} - ${dockerProcessErr}`);
      return;
    }

    fs.rename(path.resolve(repo.workdir(), 'newDockerfile'), path.resolve(repo.workdir(), 'Dockerfile'), () => {});

    const [indexErr, index] = await to(repo.refreshIndex()); 
    if (indexErr) {
      console.error(`Failed to index the git repo: ${indexErr}`);
      return;
    }

    const [stageErr, stage] = await to(index.addByPath('Dockerfile'));
    if (stageErr) {
      console.error(`Failed to stage dockerfile for commit: ${stageErr}`);
      return;
    }

    const [writeIndexErr, writeIndex] = await to(index.write());
    if (writeIndexErr) {
      console.error(`Failed to commit the updated file: ${writeIndexErr}`);
      return;
    }

    const [oidErr, oid] = await to(index.writeTree());
    if (oidErr) {
      console.error(`Failed to get oid: ${oidErr}`);
      return;
    }

    const [refErr, refs] = await to(repo.getReferences());
    if (refErr) {
      console.error(`Failed to get git remote branches: ${refErr}`);
    }
      
    const parent = await repo.getHeadCommit();
    const author = Signature.now("Flux Automation", "flux.automation@example.com");
    const commitId = await repo.createCommit("HEAD", author, author, "Golden Image Update", oid, [parent]);
    const branch = await repo.createBranch("golden-image-" + imageTag, commitId, true);
    const refNames = refs.map(ref => ref.name());
    const [refPresent, noRefPresent] = await to(findRemoteRef(refNames, "golden-image-" + imageTag));
    if (refPresent) {
      console.debug(`${repoName} already has branch ${branch}`);
      return;
    }

    const remote = await repo.getRemote('origin');
    const ref = "refs/heads/golden-image-" + imageTag + ":refs/heads/golden-image-" + imageTag;

    const [pushErr, push] = await to(remote.push([ref]));
    if (pushErr) {
      console.error(`Failed to push branch ${branch.name()}: ${pushErr}`);
      return;
    }

    console.log(`finished processing ${repoName}, branch is golden-image-${imageTag}`);

  });

})();



