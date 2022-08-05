import Config, { emptyConfig } from '../lib/config';

const appName = 'random app name';
const appDir = '/random-folder/';
const nodeName = 'random node name';
const configFullPath = `${appDir}${appName}/${appName}.cfg`;
const configMock = {
  ...emptyConfig,
  rewardAddress: 'random reward address',
  nodeName,
  plot: {
    location: `${appDir}${appName}`,
    sizeGB: 10,
  }
};

const tauriFsMock = {
  removeDir: jest.fn(),
  createDir: jest.fn().mockResolvedValue({}),
  removeFile: jest.fn(),
  readTextFile: jest.fn().mockResolvedValue(JSON.stringify(configMock)),
  writeFile: jest.fn(),
};

const params = {
  fs: tauriFsMock,
  appName,
  appDir,
  errorLogger: jest.fn(),
};

// TODO: 
// it will be nice to test with real files without mocking tauri.fs, 
// but at the moment it does not work in testing environment. 
// Investigate if there is way to make it work
describe('Config module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create instance', () => {
    const config = new Config(params);

    expect(config).toHaveProperty('init');
    expect(config).toHaveProperty('validate');
    expect(config).toHaveProperty('remove');
    expect(config).toHaveProperty('readConfigFile');
    expect(config).toHaveProperty('update');
  });

  it('init method should read config if there is one', async () => {
    const config = new Config(params);

    config.readConfigFile = jest.fn().mockResolvedValue(configMock);

    await config.init();

    expect(config.readConfigFile).toHaveBeenCalled();
  });

  it('init method should create directory and config file if there is none', async () => {
    const config = new Config(params);

    config.readConfigFile = jest.fn().mockRejectedValue(new Error);
    config['write'] = jest.fn().mockResolvedValue(null);

    await config.init();

    expect(tauriFsMock.createDir).toHaveBeenCalledWith(config['configDir']);
    expect(config['write']).toHaveBeenCalledWith(emptyConfig);
  });

  it('validate method should return "true" if there is a valid config file', async () => {
    const config = new Config(params);

    config.readConfigFile = jest.fn().mockResolvedValue(configMock);

    const result = await config.validate();

    expect(config.readConfigFile).toHaveBeenCalled();
    expect(result).toBe(true);
  });

  it('validate method should return "false" if config file is empty', async () => {
    const config = new Config(params);

    config.readConfigFile = jest.fn().mockResolvedValue(emptyConfig);

    const result = await config.validate();

    expect(config.readConfigFile).toHaveBeenCalled();
    expect(result).toBe(false);
  });

  it('remove method should remove config file using tauri.fs method', async () => {
    const config = new Config(params);

    await config.remove();

    expect(tauriFsMock.removeFile).toHaveBeenCalledWith(configFullPath);
  });

  it('readConfigFile method should read config file and return it as an object', async () => {
    const config = new Config(params);

    const result = await config.readConfigFile();

    expect(tauriFsMock.readTextFile).toHaveBeenCalledWith(configFullPath);
    expect(result).toEqual(configMock);
  });

  it('update method should update given property/properties in the config file', async () => {
    const config = new Config(params);
    const newName = 'new node name';
    
    config['write'] = jest.fn().mockResolvedValue(null);

    await config.update({ nodeName: newName });

    const expected = {
      ...configMock,
      nodeName: newName,
    };

    expect(config['write']).toHaveBeenCalledWith(expected);
  });
});
