'use strict';

const sinon = require('sinon');
const sandbox = sinon.createSandbox();
const { deployByRos } = require('../../lib/deploy/deploy-support-ros');
const client = require('../../lib/client');
const { setProcess } = require('../test-utils');
const trigger = require('../../lib/trigger');
const assert = sandbox.assert;
const uuid = require('uuid');
const inquirer = require('inquirer');
const time = require('../../lib/time');
const os = require('os');

const changes = [
  {
    'ResourceChange': {
      'LogicalResourceId': 'RosDemo',
      'ResourceType': 'ALIYUN::FC::Service',
      'Action': 'Modify',
      'Details': [
        {
          'Target': {
            'Name': 'Description'
          }
        }
      ]
    }
  },
  {
    'ResourceChange': {
      'LogicalResourceId': 'RosDemoRosDemo',
      'ResourceType': 'ALIYUN::FC::Function',
      'Action': 'Modify',
      'Details': [
        {
          'Target': {
            'Name': 'Code'
          }
        },
        {
          'Target': {
            'Name': 'Timeout'
          }
        },
        {
          'Target': {
            'Name': 'Runtime'
          }
        }
      ]
    }
  }
];

const tpl = {
  'Parameters': {
    'Desc': {
      'Type': 'String',
      'Default': 'default'
    },
    'key': {
      'Type': 'String',
      'Default': 'value'
    }
  }
};

const mergedParam = {
  'Parameters.3.ParameterKey': 'key',
  'Parameters.3.ParameterValue': 'value',
  'Parameters.2.ParameterKey': 'Desc',
  'Parameters.2.ParameterValue': 'ellison',
  'Parameters.1.ParameterKey': 'Desc',
  'Parameters.1.ParameterValue': 'ecs.t1.small'
};

const stackName = 'stackName';

const stackId = 'c2234cf3-40f1-440f-b634-51370180589a';

const listParams = {
  'RegionId': 'cn-beijing',
  'StackName.1': stackName,
  'PageSize': 50,
  'PageNumber': 1,
  'ShowNestedStack': false
};

const listEventsParams = {
  'StackId': stackId,
  'RegionId': 'cn-beijing',
  'PageSize': 50,
  'PageNumber': 1
};

const getTemplateParams = {
  'RegionId': 'cn-beijing',
  'StackId': stackId
};

const updateParams = {
  RegionId: 'cn-beijing',
  ChangeSetName: 'fun-random',
  StackId: stackId,
  ChangeSetType: 'UPDATE',
  Description: 'generated by Funcraft',
  TemplateBody: JSON.stringify(Object.assign(tpl, mergedParam)),
  DisableRollback: false,
  TimeoutInMinutes: 10
};

const getChangeSetParam = {
  'RegionId': 'cn-beijing',
  'ChangeSetId': 'changeSetId',
  'ShowTemplate': true
};

const execChangeSetParams = {
  RegionId: 'cn-beijing',
  ChangeSetId: 'changeSetId'
};

const events = [
  { StatusReason: 'state changed',
    Status: 'UPDATE_COMPLETE',
    PhysicalResourceId: '9daa0176-02df-45b0-b0cc-22f66b6ff41f',
    LogicalResourceId: 'RosDemotest5',
    ResourceType: 'ALIYUN::ROS::Stack',
    StackId: 'db7d6ddc-b089-4a9f-baaf-79169d2eed6f',
    CreateTime: '2019-10-09T13:27:15',
    EventId: '5138c28b-08b2-4d6e-be6c-865f91779ebc',
    StackName: 'coco-superme'
  },
  { StatusReason: 'state changed',
    Status: 'UPDATE_COMPLETE',
    PhysicalResourceId: 'e2c71fd2-5bfb-4693-a4ef-728ecabc7613',
    LogicalResourceId: 'RosDemotest2',
    ResourceType: 'ALIYUN::FC::Function',
    StackId: 'db7d6ddc-b089-4a9f-baaf-79169d2eed6f',
    CreateTime: '2019-10-09T13:27:15',
    EventId: '2a6d975c-b1bc-40fe-a848-508a29269260',
    StackName: 'coco-superme'
  },
  { StatusReason: 'state changed',
    Status: 'UPDATE_COMPLETE',
    PhysicalResourceId: '27fe8d7d-657c-4e2c-8a02-7ef3e8f1fa0a',
    LogicalResourceId: 'RosDemotest1',
    ResourceType: 'ALIYUN::FC::Function',
    StackId: 'db7d6ddc-b089-4a9f-baaf-79169d2eed6f',
    CreateTime: '2019-10-09T13:27:15',
    EventId: '95519d25-3a4d-4321-96c3-c0b796d37789',
    StackName: 'coco-superme'
  },
  { StatusReason: 'state changed',
    Status: 'UPDATE_IN_PROGRESS',
    PhysicalResourceId: 'f5dcf959-07e7-4acc-8d45-9fab9ccac711',
    LogicalResourceId: 'RosDemotest3',
    ResourceType: 'ALIYUN::ROS::Stack',
    StackId: 'db7d6ddc-b089-4a9f-baaf-79169d2eed6f',
    CreateTime: '2019-10-09T13:27:15',
    EventId: '4bcd4524-f9d8-42c1-b097-aca101007e86',
    StackName: 'coco-superme'
  }
];

const eventsForStackProcess = [
  { StatusReason: 'state changed',
    Status: 'UPDATE_IN_PROGRESS',
    PhysicalResourceId: 'f5dcf959-07e7-4acc-8d45-9fab9ccac711',
    LogicalResourceId: 'RosDemotest3',
    ResourceType: 'ALIYUN::ROS::Stack',
    StackId: 'db7d6ddc-b089-4a9f-baaf-79169d2eed6f',
    CreateTime: '2019-10-09T13:27:15',
    EventId: '4bcd4524-f9d8-42c1-b097-aca101007e86',
    StackName: 'coco-superme'
  }
];

const resultsForStackProcess = {
  'PageNumber': 1,
  'TotalCount': 20,
  'PageSize': 50,
  'Events': eventsForStackProcess
};

const listEventsResults = {
  'PageNumber': 1,
  'TotalCount': 20,
  'PageSize': 50,
  'Events': events
};

const answerForYes = {
  ok: true
};

const answerForNo = {
  ok: false
};

const getTemplateResults = {
  'TemplateBody': JSON.stringify({'ROSTemplateFormatVersion': '2015-09-01', 'Resources': {'cdn-test-service': {'Type': 'ALIYUN::FC::Service', 'Properties': {'InternetAccess': true, 'ServiceName': 'ros-http-cdn-test-service-6FAACA49EA80', 'Description': 'cdn trigger test5', 'LogConfig': {'Project': '', 'Logstore': ''}}}, 'cdn-test-servicecdn-test-function': {'Type': 'ALIYUN::FC::Function', 'Properties': {'Code': {'OssBucketName': 'ros-http', 'OssObjectName': 'eac787304be9978d81a408699a3a0dc9'}, 'FunctionName': 'ros-http-cdn-test-function-22509E326CCF', 'ServiceName': 'ros-http-cdn-test-service-6FAACA49EA80', 'EnvironmentVariables': {'PATH': '/code/.fun/root/usr/local/bin:/code/.fun/root/usr/local/sbin:/code/.fun/root/usr/bin:/code/.fun/root/usr/sbin:/code/.fun/root/sbin:/code/.fun/root/bin:/code/.fun/python/bin:/usr/local/bin:/usr/local/sbin:/usr/bin:/usr/sbin:/sbin:/bin', 'LD_LIBRARY_PATH': '/code/.fun/root/usr/lib:/code/.fun/root/usr/lib/x86_64-linux-gnu:/code:/code/lib:/usr/local/lib', 'PYTHONUSERBASE': '/code/.fun/python'}, 'Handler': 'index.handler', 'Runtime': 'nodejs10'}, 'DependsOn': 'cdn-test-service'}, 'cdn-test-servicecdn-test-functionhttp-test': {'Type': 'ALIYUN::FC::Trigger', 'Properties': {'ServiceName': 'ros-http-cdn-test-service-6FAACA49EA80', 'TriggerConfig': {'authType': 'anonymous', 'methods': ['GET', 'POST', 'PUT']}, 'FunctionName': 'ros-http-cdn-test-function-22509E326CCF', 'TriggerName': 'http-test', 'TriggerType': 'http'}, 'DependsOn': 'cdn-test-servicecdn-test-function'}}}),
  'RequestId': '783233CD-C3C1-4A4A-A8D8-09515781F74E'
};

const parameters = [
  {
    'ParameterValue': 'AccountId',
    'ParameterKey': 'ALIYUN::AccountId'
  },
  {
    'ParameterValue': 'None',
    'ParameterKey': 'ALIYUN::NoValue'
  },
  {
    'ParameterValue': 'cn-shanghai',
    'ParameterKey': 'ALIYUN::Region'
  },
  {
    'ParameterValue': 'cb0a3c50-64b5-4ead-80ab-1405c083108d',
    'ParameterKey': 'ALIYUN::StackId'
  },
  {
    'ParameterValue': 'ros-param',
    'ParameterKey': 'ALIYUN::StackName'
  },
  {
    'ParameterValue': 'service-description',
    'ParameterKey': 'Desc'
  }
];

const originParameters = [
  {
    'ParameterValue': '1984152879328320',
    'ParameterKey': 'ALIYUN::AccountId'
  },
  {
    'ParameterValue': 'None',
    'ParameterKey': 'ALIYUN::NoValue'
  },
  {
    'ParameterValue': 'cn-shanghai',
    'ParameterKey': 'ALIYUN::Region'
  },
  {
    'ParameterValue': 'cb0a3c50-64b5-4ead-80ab-1405c083108d',
    'ParameterKey': 'ALIYUN::StackId'
  },
  {
    'ParameterValue': 'ros-param',
    'ParameterKey': 'ALIYUN::StackName'
  },
  {
    'ParameterValue': 'ecs.t1.small',
    'ParameterKey': 'Desc'
  }
];


const parameterOverride = {
  'Desc': 'ellison',
  'key': 'value'
};

const getStackResult = {
  Outputs: [{
    Description: 'cdn trigge12312312312',
    OutputValue: '64497a31-de68-4cb2-9257-89352c012186',
    OutputKey: 'cdn-trigger-id'
  }],
  Parameters: originParameters
};

describe('test deploy support ros', () => {
  const requestOption = {
    method: 'POST'
  };

  let rosClient;
  let requestStub;
  let restoreProcess;
  beforeEach(() => {
    restoreProcess = setProcess({
      ACCOUNT_ID: 'testAccountId',
      ACCESS_KEY_ID: 'testKeyId',
      ACCESS_KEY_SECRET: 'testKeySecret',
      FC_ENDPOINT: 'test fc endpoint',
      REGION: 'cn-beijing'
    });

    requestStub = sandbox.stub();

    sandbox.stub(trigger, 'displayTriggerInfo');

    rosClient = {
      request: requestStub
    };

    sandbox.stub(time, 'sleep');
    sandbox.stub(client, 'getRosClient').resolves(rosClient);
    sandbox.stub(uuid, 'v4').returns('random');
  });

  afterEach(() => {
    restoreProcess();
    sandbox.restore();
  });

  it.skip('fix ros deploy undefined bug', async () => {
    requestStub.withArgs('ListStacks', listParams, requestOption).resolves({
      'PageNumber': 1,
      'TotalCount': 3,
      'PageSize': 50,
      'Stacks': [
        {
          'StackId': stackId,
          'StackName': stackName
        }
      ]
    });

    requestStub.withArgs('CreateChangeSet', updateParams, requestOption).resolves({
      ChangeSetId: 'changeSetId'
    });

    requestStub.withArgs('GetChangeSet', getChangeSetParam).resolves({
      'Status': 'COMPLETE',
      'Changes': changes
    });

    requestStub.withArgs('ExecuteChangeSet', execChangeSetParams, requestOption).resolves();
    requestStub.withArgs('ListStackEvents', listEventsParams, requestOption).onFirstCall().resolves(resultsForStackProcess);
    requestStub.withArgs('ListStackEvents', listEventsParams, requestOption).onSecondCall().resolves(listEventsResults);
    requestStub.withArgs('GetTemplate', getTemplateParams, requestOption).resolves(getTemplateResults);

    await deployByRos(os.tmpdir(), stackName, tpl, true);

    assert.calledWith(requestStub.firstCall, 'ListStacks', listParams, requestOption);
    assert.calledWith(requestStub.secondCall, 'CreateChangeSet', updateParams, requestOption);
    assert.calledWith(requestStub.thirdCall, 'GetChangeSet', getChangeSetParam, requestOption);
    assert.calledWith(requestStub.lastCall, 'GetTemplate', getTemplateParams, requestOption);

    assert.callCount(requestStub, 7);
    assert.notCalled(inquirer.prompt);
  });

  it('test deploy by ros with assumeYes is true', async () => {

    sandbox.stub(inquirer, 'prompt').resolves(answerForYes);

    requestStub.withArgs('ListStacks', listParams, requestOption).resolves({
      'PageNumber': 1,
      'TotalCount': 3,
      'PageSize': 50,
      'Stacks': [
        {
          'StackId': stackId,
          'StackName': stackName
        }
      ]
    });

    requestStub.withArgs('CreateChangeSet', Object.assign(updateParams, mergedParam), requestOption).resolves({
      ChangeSetId: 'changeSetId'
    });

    requestStub.withArgs('GetChangeSet', getChangeSetParam).resolves({
      'Status': 'COMPLETE',
      'Changes': changes,
      'TemplateBody': '{"ROSTemplateFormatVersion": "2015-09-01", "Transform": "Aliyun::Serverless-2018-04-03", "Resources": {"cdn-test-service": {"cdn-test-function": {"Type": "Aliyun::Serverless::Function", "Properties": {"CodeUri": "oss://ros-ellison/afd55baf6a9cf552d09c7d9828015f02", "Handler": "index.handler", "Runtime": "nodejs6"}}, "Type": "Aliyun::Serverless::Service", "Properties": {"Description": "cdn triggerssss"}}}, "Outputs": {"cdn-trigger-id": {"Value": {"Ref": "cdn-test-service"}, "Description": "cdn trigge12312312312", "Condition": false}}}',
      'Parameters': parameters
    });

    requestStub.withArgs('GetStack', getTemplateParams, requestOption).resolves(getStackResult);

    requestStub.withArgs('ExecuteChangeSet', execChangeSetParams, requestOption).resolves();
    requestStub.withArgs('ListStackEvents', listEventsParams, requestOption).resolves(listEventsResults);
    requestStub.withArgs('GetTemplate', getTemplateParams, requestOption).resolves(getTemplateResults);

    await deployByRos(os.tmpdir(), stackName, tpl, true, parameterOverride);

    assert.calledWith(requestStub.firstCall, 'ListStacks', listParams, requestOption);
    assert.calledWith(requestStub.secondCall, 'GetStack', getTemplateParams, requestOption);
    assert.calledWith(requestStub.thirdCall, 'CreateChangeSet', updateParams, requestOption);
    assert.calledWith(requestStub.lastCall, 'GetStack', getTemplateParams, requestOption);

    assert.callCount(requestStub, 8);
    assert.notCalled(inquirer.prompt);

    assert.calledWith(trigger.displayTriggerInfo, 'ros-http-cdn-test-service-6FAACA49EA80', 'ros-http-cdn-test-function-22509E326CCF', 'http-test', 'http', {
      'authType': 'anonymous',
      'methods': [
        'GET',
        'POST',
        'PUT'
      ]
    });
  });

  it('test deploy by ros with assumeYes is false', async () => {

    sandbox.stub(inquirer, 'prompt').resolves(answerForNo);

    requestStub.withArgs('ListStacks', listParams, requestOption).resolves({
      'PageNumber': 1,
      'TotalCount': 3,
      'PageSize': 50,
      'Stacks': [
        {
          'StackId': stackId,
          'StackName': stackName
        }
      ]
    });

    requestStub.withArgs('GetStack', getTemplateParams, requestOption).resolves(getStackResult);

    requestStub.withArgs('CreateChangeSet', Object.assign(updateParams, mergedParam), requestOption).resolves({
      ChangeSetId: 'changeSetId'
    });

    requestStub.withArgs('GetChangeSet', getChangeSetParam).resolves({
      'Status': 'CREATE_COMPLETE',
      'Changes': changes,
      'ExecutionStatus': 'AVAILABLE'
    });

    requestStub.withArgs('ExecuteChangeSet', execChangeSetParams, requestOption).resolves();

    const promptArguments = [{
      message: 'Please confirm to continue.',
      name: 'ok',
      type: 'confirm'
    }];

    requestStub.withArgs('ListStackEvents', listEventsParams, requestOption).resolves(listEventsResults);

    await deployByRos(os.tmpdir(), stackName, tpl, false, parameterOverride);

    assert.calledWith(requestStub.firstCall, 'ListStacks', listParams, requestOption);
    assert.calledWith(requestStub.secondCall, 'GetStack', getTemplateParams, requestOption);
    assert.calledWith(requestStub.thirdCall, 'CreateChangeSet', updateParams, requestOption);
    assert.calledWith(requestStub.lastCall, 'DeleteStack', getTemplateParams, requestOption);
    assert.calledWith(inquirer.prompt, promptArguments);
  });
});