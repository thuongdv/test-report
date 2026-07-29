import { CreatePRAgent } from './create-pr.agent';
import type { AgentContext } from '../core/types';
import { PullRequestSkill } from '../skills/pull-request.skill';

jest.mock('../skills/pull-request.skill');

describe('CreatePRAgent', () => {
  let agent: CreatePRAgent;
  let mockPullRequest: jest.Mocked<PullRequestSkill>;

  const context: AgentContext = {
    workDir: '/test/repo',
    env: {
      GITHUB_TOKEN: 'test-token',
      GITHUB_REPOSITORY: 'owner/repo',
      PR_NUMBER: '10',
      PR_BRANCH: 'feature-branch',
    },
    baseRef: 'origin/main',
    headRef: 'HEAD',
    prNumber: '10',
    prBranch: 'feature-branch',
    repository: 'owner/repo',
    args: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();

    mockPullRequest = PullRequestSkill.prototype as any;
    mockPullRequest.detectGeneratedTestFiles = jest.fn();
    mockPullRequest.execute = jest.fn();

    agent = new CreatePRAgent();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should have the correct name', () => {
    expect(agent.name).toBe('create-pr');
  });

  it('should return failure when PR_NUMBER is missing', async () => {
    const noPrCtx = {
      ...context,
      prNumber: undefined,
      env: { ...context.env },
    };
    delete (noPrCtx.env as any).PR_NUMBER;

    const result = await agent.run(noPrCtx);

    expect(result.status).toBe('failure');
    expect(result.summary).toContain('Missing PR_NUMBER');
  });

  it('should return failure when PR_BRANCH is missing', async () => {
    const noBranchCtx = {
      ...context,
      prBranch: undefined,
      env: { ...context.env },
    };
    delete (noBranchCtx.env as any).PR_BRANCH;

    const result = await agent.run(noBranchCtx);

    expect(result.status).toBe('failure');
    expect(result.summary).toContain('Missing');
  });

  it('should return skipped when no test files found', async () => {
    mockPullRequest.detectGeneratedTestFiles.mockReturnValue([]);

    const result = await agent.run(context);

    expect(result.status).toBe('skipped');
    expect(result.summary).toContain('No generated test files');
  });

  it('should create PR and return success', async () => {
    mockPullRequest.detectGeneratedTestFiles.mockReturnValue([
      'src/app.spec.ts',
      'src/utils.spec.ts',
    ]);
    mockPullRequest.execute.mockResolvedValue({
      prUrl: 'https://github.com/owner/repo/pull/42',
      prNumber: 42,
      isUpdate: false,
    });

    const result = await agent.run(context);

    expect(result.status).toBe('success');
    expect(result.summary).toContain('Created');
    expect(result.summary).toContain('#42');
    expect(result.data?.generatedFiles).toEqual([
      'src/app.spec.ts',
      'src/utils.spec.ts',
    ]);
  });

  it('should report update when existing PR found', async () => {
    mockPullRequest.detectGeneratedTestFiles.mockReturnValue(['src/app.spec.ts']);
    mockPullRequest.execute.mockResolvedValue({
      prUrl: 'https://github.com/owner/repo/pull/42',
      prNumber: 42,
      isUpdate: true,
    });

    const result = await agent.run(context);

    expect(result.status).toBe('success');
    expect(result.summary).toContain('Updated');
  });
});
