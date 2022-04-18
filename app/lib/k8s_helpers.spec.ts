import { getImagePolicies, resolvePolicy, resolveConfig } from './k8s_helpers';
import { parseYaml, getRepos } from './helpers';

describe('get image policies from flux', () => {
  it('should get a policy', async () => {
    const pol: any = await getImagePolicies('flux-system');
    expect(pol.body.items.length).toBeGreaterThan(0);
  });

  it('should resolve a policy', async () => {
    const policy = await resolvePolicy('node', 'flux-system');
    expect(policy.includes("node")).toEqual(true);
  });

  it('should not resolve a policy', async () => {
    const policy = await resolvePolicy('doesnotexist', 'flux-system');
    expect(policy.length).toEqual(0);
  });

  it('should resolve config', async () => {
    const config = await resolveConfig('image-updater-config', 'flux-system');
    const parsedYaml = parseYaml(config);
    expect(parsedYaml).toEqual({
      "github": {
        "link_url": "https://github.com"
      }, "repos": {
        "rust": [
           "olivercodes/chalupa-bot",
           "olivercodes/chalupa-bot-test",
        ]
      }
      });
    expect(parsedYaml["repos"]["rust"].length).toEqual(2);
    expect(getRepos(parsedYaml)).toEqual(
      {"rust": ["olivercodes/chalupa-bot", "olivercodes/chalupa-bot-test"]}
    );
  });
});



