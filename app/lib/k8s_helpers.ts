import * as k8s from '@kubernetes/client-node';
import { V1ConfigMap } from '@kubernetes/client-node';
import { to } from 'await-to-js';

const kc = new k8s.KubeConfig();
// kc.loadFromDefault();
kc.loadFromCluster();
const k8sCrd = kc.makeApiClient(k8s.CustomObjectsApi);
const k8sApi = kc.makeApiClient(k8s.CoreV1Api);


export async function getImagePolicies(namespace) {
  return k8sCrd.listNamespacedCustomObject(
    'image.toolkit.fluxcd.io',
    'v1beta1',
    namespace,
    'imagepolicies' // plural
  );
}

export async function resolvePolicy(policyName, namespace) {
  try {
    const policies: any = await getImagePolicies(namespace);
    return policies.body.items
      .filter(policy => policy.metadata.name.includes(policyName))
      .map(pol => pol.status.latestImage)
      .reduce((p, c) => c, "");
  } catch (e) {
      console.info("Resolve policy failed: " + e);
  }
}

export async function configMapGetFn(cmName: string, namespace: string) {
  const cm = await k8sApi.readNamespacedConfigMap(cmName, 'flux-system');
  return cm;
}

export async function resolveConfig(configName, namespace) {

  const [err, configMap] = await to(configMapGetFn(configName, namespace));

  if (err) {
    throw new Error(`Failed to fetch the configmap ${configName}, set LOG_LEVEL to debug for more info`);
    console.debug(err);
  }

  return configMap.body.data["config.yaml"];
}

export function parseConfigmap(configMap: V1ConfigMap) {
  return configMap.data["config.yaml"];
}

