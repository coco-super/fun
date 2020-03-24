'use strict';

const _ = require('lodash');
const fs = require('fs-extra');
const path = require('path');
const debug = require('debug')('fun:deploy');
const { generateFile } = require('./common/file');

const { red, green } = require('colors');
const { isZipArchive, readZipFile } = require('../package/zip');

const frameworks = [
  // php
  require('./thinkphp'),

  // java
  require('./spring-boot'),

  // node
  require('./egg'),
  require('./nuxt'),
  require('./express'),
  require('./next'),
  require('./hexo'),

  // go
  require('./go')
];

const runtimeCheckFiles = ['package.json', 'pom.xml', 'composer.json'];

function resolvePath(p) {
  if (_.isArray(p)) {
    return path.join(...p);
  }
  return p;
}

const runtimeCheckers = {
  'nodejs': {
    'type': 'file',
    'path': 'package.json'
  },
  'java': async (codeDir) => {
    const stat = await fs.lstat(codeDir);

    if (stat.isFile()) {
      throw new Error('file is not supported');
    }

    const pomPath = path.join(codeDir, 'pom.xml');

    return await fs.pathExists(pomPath);
  },
  'php': {
    'type': 'file',
    'path': 'composer.json'
  },
  'go': {
    'type': 'file',
    'paths': ['go.mod', 'Gopkg.toml', ['vendor', 'vendor.json'], ['Godeps', 'Godeps.json'], /\.go$/]
  }
};

async function parseRulePaths(codeDir, rule) {
  const rs = [];
  const paths = rule.paths || [rule.path];
  for (const relativePath of paths) {
    if (_.isRegExp(relativePath)) {
      const pathRegex = relativePath;
      const files = await fs.readdir(codeDir);

      for (const file of files) {
        if (pathRegex.test(file)) {
          rs.push(path.join(codeDir, file));
        }
      }
    } else {
      rs.push(path.join(codeDir, resolvePath(relativePath)));
    }

    const pomPath = path.join(codeDir, 'composer.json');

    return await fs.pathExists(pomPath);
  }

  return rs;
}

async function checkJsonRule(codeDir, rule) {
  const jsonKey = rule.jsonKey;
  const jsonValueContains = rule.jsonValueContains;

  const fileContent = await readFileContent(codeDir, resolvePath(rule.path));
  if (!fileContent) { return false; }

  const json = JSON.parse(fileContent.toString());
  if (!_.has(json, jsonKey)) { return false; }

  const value = _.get(json, jsonKey);
  if (jsonValueContains !== undefined && jsonValueContains !== null) {
    return _.includes(value, jsonValueContains);
  }
  return true;
}

async function checkContainsRule(codeDir, rule) {
  const paths = await parseRulePaths(codeDir, rule);
  const content = rule.content;
  for (const relativePath of paths) {
    const fileContent = await readFileContent(codeDir, resolvePath(relativePath));

    if (!fileContent) { continue; }
    if (_.includes(fileContent.toString(), content)) { return true; }
  }

  return false;
}

async function checkDirRule(codeDir, rule) {
  const paths = rule.paths || [rule.path];
  for (const relativePath of paths) {
    const fileContent = await readFileContent(codeDir, resolvePath(relativePath));
    if (fileContent) { return true; }
  }

  return false;
}

async function checkFileRule(codeDir, rule) {
  const paths = await parseRulePaths(codeDir, rule);
  for (const f of paths) {
    if (await fs.pathExists(f)) {
      const stat = await fs.stat(f);
      if (stat.isFile()) { return true; }
    }
  }

  return false;
}

async function readFileContent(codeUri, relativePath) {
  if (isZipArchive(codeUri)) {
    const [data, error] = await handle(readZipFile(codeUri, relativePath));
    if (error) { return null; }

    return data;
  }

  const p = path.join(codeUri, relativePath);

  if (!await fs.pathExists(p)) {
    return null;
  }

  return await fs.readFile(p);
}

async function checkRegexRule(codeDir, rule) {
  const paths = rule.paths || [rule.path];
  if (!paths) { return false; }

  const regexContent = rule.content;
  const regex = new RegExp(regexContent, 'gm');

  for (const relativePath of paths) {

    const fileContent = await readFileContent(codeDir, relativePath);
    if (!fileContent) { continue; }

    const match = regex.test(fileContent.toString());
    if (match) { return match; }
  }

  return false;
}

async function checkRule(codeDir, rule) {
  const type = rule.type;

  switch (type) {
  case 'json':
    return await checkJsonRule(codeDir, rule);
  case 'regex':
    return await checkRegexRule(codeDir, rule);
  case 'contains':
    return await checkContainsRule(codeDir, rule);
  case 'dir':
    return await checkDirRule(codeDir, rule);
  case 'file':
    return await checkFileRule(codeDir, rule);
  default:
    throw new Error(`rule type ${type} not supported`);
  }
}

async function checkRules(codeDir, rules) {
  const andRules = rules.and;
  if (andRules) {
    const checkResultPromises = _.map(andRules, (rule) => {
      return checkRule(codeDir, rule);
    });

    const everyResults = await Promise.all(checkResultPromises);

    const match = _.every(everyResults, (r) => r);
    return match;
  }

  const orRules = rules.or;
  if (orRules) {
    const checkResultPromises = _.map(orRules, (rule) => {
      return checkRule(codeDir, rule);
    });

    const everyResults = await Promise.all(checkResultPromises);

    const match = _.some(everyResults, (r) => r);
    return match;
  }

  return false;
}

async function execProcessor(codeDir, processor) {
  debug('exec processor', processor);
  switch (processor.type) {
  case 'function': {
    const func = processor.function;
    await func(codeDir);
    return;
  }
  case 'generateFile': {
    let p = resolvePath(processor.path);
    p = path.join(codeDir, p);

    await fs.ensureDir(path.dirname(p));

    const mode = processor.mode;
    const content = processor.content;

    await generateFile(p, processor.backup, mode, content);
    
    return;
  }
  default:
    throw new Error(`not supported processor ${JSON.stringify(processor)}`);
  }
}

async function detectFramework(codeDir) {
  for (const framework of frameworks) {
    let checkResult;

    if (isZipArchive(codeDir)) {

      checkResult = await findRuntimeCheckFileContent(codeDir);
    } else {
      const runtime = framework.runtime;
      const runtimeChecker = runtimeCheckers[runtime];

      if (!runtimeChecker) {
        throw new Error('could not found runtime checker');
      }
      checkResult = await runtimeChecker(codeDir);
    }

    if (checkResult) {
      const detectors = framework.detectors;

      // no need to detect
      if (_.isEmpty(detectors)) { return framework; }

      const match = await checkRules(codeDir, detectors);
      if (match) {
        return framework;
      }
    }
  }

  return null;
}

const handle = (promise) => {
  return promise
    .then(data => ([data, undefined]))
    .catch(error => Promise.resolve([undefined, error]));
};

async function findRuntimeCheckFileContent(zipPath) {
  for (const file of runtimeCheckFiles) {
    const [data, error] = await handle(readZipFile(zipPath, file));
    if (!error) { return data.toString(); }
  }
  return null;
}

async function execFrameworkActions(codeDir, framework) {
  const actions = framework.actions;

  if (actions) {
    for (const action of actions) {
      const condition = action.condition;

      if (_.isBoolean(condition)) {
        if (!condition) { continue; }
      } else if (condition) {
        const checkResult = await checkRules(codeDir, condition);
        debug(`action condition ${JSON.stringify(condition, null, 4)}, checkResult ${checkResult}`);

        if (!checkResult) { continue; }
      } else {
        throw new Error(`not supported condition value ${condition}`);
      }

      const processors = action.processors;
      for (const processor of processors) {
        await execProcessor(codeDir, processor);
      }
    }
  }
}

async function generateTemplateContent(folderName) {
  const templateYmlContent = `ROSTemplateFormatVersion: '2015-09-01'
Transform: 'Aliyun::Serverless-2018-04-03'
Resources:
  ${folderName}: # service name
    Type: 'Aliyun::Serverless::Service'
    Properties:
      Description: This is FC service
      LogConfig: Auto
    ${folderName}: # function name
      Type: 'Aliyun::Serverless::Function'
      Properties:
        Handler: index.handler
        Runtime: custom
        CodeUri: ./
        MemorySize: 1024
        InstanceConcurrency: 5
        Timeout: 120
      Events:
        httpTrigger:
          Type: HTTP
          Properties:
            AuthType: ANONYMOUS
            Methods: ['GET', 'POST', 'PUT']
  Domain:
    Type: Aliyun::Serverless::CustomDomain
    Properties:
      DomainName: Auto
      Protocol: HTTP
      RouteConfig:
        Routes:
          "/*":
            ServiceName: ${folderName}
            FunctionName: ${folderName}
  `;
  return templateYmlContent;
}

async function parsingFramework(zipPath) {
  const framework = await detectFramework(zipPath);

  if (!framework) {
    throw new Error('can not find any framework.');
  }

  const actions = framework.actions;

  if (actions) {
    for (const action of actions) {
      const condition = action.condition;

      if (_.isBoolean(condition)) {
        if (!condition) { continue; }
      } else if (condition) {
        const checkResult = await checkRules(zipPath, condition);
        debug(`action condition ${JSON.stringify(condition, null, 4)}, checkResult ${checkResult}`);

        if (!checkResult) { continue; }
      } else {
        throw new Error(`not supported condition value ${condition}`);
      }

      const processors = action.processors;
      for (const processor of processors) {
        return {
          port: '9000',
          command: processor.content
        };
      }
    }
  }
}

module.exports = {
  detectFramework,
  generateTemplateContent,
  execFrameworkActions,
  parsingFramework
};