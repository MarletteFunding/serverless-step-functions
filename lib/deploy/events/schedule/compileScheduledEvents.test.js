'use strict';

const expect = require('chai').expect;
const Serverless = require('serverless/lib/Serverless');
const AwsProvider = require('serverless/lib/plugins/aws/provider');
const ServerlessStepFunctions = require('./../../../index');

describe('#httpValidate()', () => {
  let serverless;
  let serverlessStepFunctions;

  beforeEach(() => {
    serverless = new Serverless();
    serverless.setProvider('aws', new AwsProvider(serverless));
    const options = {
      stage: 'dev',
      region: 'us-east-1',
    };
    serverless.service.provider.compiledCloudFormationTemplate = { Resources: {} };
    serverless.configSchemaHandler = {
      // eslint-disable-next-line no-unused-vars
      defineTopLevelProperty: (propertyName, propertySchema) => {},
    };
    serverlessStepFunctions = new ServerlessStepFunctions(serverless, options);
  });

  describe('#compileScheduledEvents()', () => {
    it('should throw an error if schedule event type is not a string or an object', () => {
      serverlessStepFunctions.serverless.service.stepFunctions = {
        stateMachines: {
          first: {
            events: [
              {
                schedule: 42,
              },
            ],
          },
        },
      };

      expect(() => serverlessStepFunctions.compileScheduledEvents()).to.throw(Error);
    });

    it('should throw an error if the "rate" property is not given', () => {
      serverlessStepFunctions.serverless.service.stepFunctions = {
        stateMachines: {
          first: {
            events: [
              {
                schedule: {
                  rate: null,
                },
              },
            ],
          },
        },
      };

      expect(() => serverlessStepFunctions.compileScheduledEvents()).to.throw(Error);
    });

    it('should create corresponding resources when schedule events are given', () => {
      serverlessStepFunctions.serverless.service.stepFunctions = {
        stateMachines: {
          first: {
            events: [
              {
                schedule: {
                  rate: 'rate(10 minutes)',
                  enabled: false,
                },
              },
              {
                schedule: {
                  rate: 'rate(10 minutes)',
                  enabled: true,
                },
              },
              {
                schedule: 'rate(10 minutes)',
              },
            ],
          },
        },
      };

      serverlessStepFunctions.compileScheduledEvents();

      expect(serverlessStepFunctions.serverless.service
        .provider.compiledCloudFormationTemplate.Resources
        .FirstStepFunctionsSchedulerSchedule1.Type).to.equal('AWS::Scheduler::Schedule');
      expect(serverlessStepFunctions.serverless.service
        .provider.compiledCloudFormationTemplate.Resources
        .FirstStepFunctionsSchedulerSchedule2.Type).to.equal('AWS::Scheduler::Schedule');
      expect(serverlessStepFunctions.serverless.service
        .provider.compiledCloudFormationTemplate.Resources
        .FirstStepFunctionsSchedulerSchedule3.Type).to.equal('AWS::Scheduler::Schedule');
      expect(serverlessStepFunctions.serverless.service
        .provider.compiledCloudFormationTemplate.Resources
        .FirstScheduleToStepFunctionsRole.Type).to.equal('AWS::IAM::Role');
    });

    it('should respect enabled variable, defaulting to true', () => {
      serverlessStepFunctions.serverless.service.stepFunctions = {
        stateMachines: {
          first: {
            events: [
              {
                schedule: {
                  rate: 'rate(10 minutes)',
                  enabled: false,
                },
              },
              {
                schedule: {
                  rate: 'rate(10 minutes)',
                  enabled: true,
                },
              },
              {
                schedule: {
                  rate: 'rate(10 minutes)',
                },
              },
              {
                schedule: 'rate(10 minutes)',
              },
            ],
          },
        },
      };

      serverlessStepFunctions.compileScheduledEvents();

      expect(serverlessStepFunctions.serverless.service
        .provider.compiledCloudFormationTemplate.Resources
        .FirstStepFunctionsSchedulerSchedule1
        .Properties.State).to.equal('DISABLED');
      expect(serverlessStepFunctions.serverless.service
        .provider.compiledCloudFormationTemplate.Resources
        .FirstStepFunctionsSchedulerSchedule2
        .Properties.State).to.equal('ENABLED');
      expect(serverlessStepFunctions.serverless.service
        .provider.compiledCloudFormationTemplate.Resources
        .FirstStepFunctionsSchedulerSchedule3
        .Properties.State).to.equal('ENABLED');
      expect(serverlessStepFunctions.serverless.service
        .provider.compiledCloudFormationTemplate.Resources
        .FirstStepFunctionsSchedulerSchedule4
        .Properties.State).to.equal('ENABLED');
    });

    it('should respect flex_time_window variable, defaulting to OFF with no max window', () => {
      serverlessStepFunctions.serverless.service.stepFunctions = {
        stateMachines: {
          first: {
            events: [
              {
                schedule: {
                  rate: 'rate(10 minutes)',
                },
              },
              {
                schedule: {
                  rate: 'cron(0 2 * * ? *)',
                  flex_time_window: 15,
                },
              },
            ],
          },
        },
      };

      serverlessStepFunctions.compileScheduledEvents();

      expect(serverlessStepFunctions.serverless.service
        .provider.compiledCloudFormationTemplate.Resources
        .FirstStepFunctionsSchedulerSchedule1
        .Properties.FlexibleTimeWindow.Mode).to.equal('OFF');
      expect(serverlessStepFunctions.serverless.service
        .provider.compiledCloudFormationTemplate.Resources
        .FirstStepFunctionsSchedulerSchedule2
        .Properties.FlexibleTimeWindow.Mode).to.equal('FLEXIBLE');
      expect(serverlessStepFunctions.serverless.service
        .provider.compiledCloudFormationTemplate.Resources
        .FirstStepFunctionsSchedulerSchedule2
        .Properties.FlexibleTimeWindow.MaximumWindowInMinutes).to.equal(15);
    });

    it('should respect timezone variable', () => {
      serverlessStepFunctions.serverless.service.stepFunctions = {
        stateMachines: {
          first: {
            events: [
              {
                schedule: {
                  rate: 'rate(10 minutes)',
                  enabled: false,
                  timezone: 'America/New_York',
                },
              },
            ],
          },
        },
      };

      serverlessStepFunctions.compileScheduledEvents();

      expect(serverlessStepFunctions.serverless.service
        .provider.compiledCloudFormationTemplate.Resources
        .FirstStepFunctionsSchedulerSchedule1
        .Properties.ScheduleExpressionTimezone).to.equal('America/New_York');
    });

    it('should respect name variable', () => {
      serverlessStepFunctions.serverless.service.stepFunctions = {
        stateMachines: {
          first: {
            events: [
              {
                schedule: {
                  rate: 'rate(10 minutes)',
                  enabled: false,
                  name: 'your-scheduled-event-name',
                },
              },
            ],
          },
        },
      };

      serverlessStepFunctions.compileScheduledEvents();

      expect(serverlessStepFunctions.serverless.service
        .provider.compiledCloudFormationTemplate.Resources
        .FirstStepFunctionsSchedulerSchedule1
        .Properties.Name).to.equal('your-scheduled-event-name');
    });

    it('should respect description variable', () => {
      serverlessStepFunctions.serverless.service.stepFunctions = {
        stateMachines: {
          first: {
            events: [
              {
                schedule: {
                  rate: 'rate(10 minutes)',
                  enabled: false,
                  description: 'your scheduled event description',
                },
              },
            ],
          },
        },
      };

      serverlessStepFunctions.compileScheduledEvents();

      expect(serverlessStepFunctions.serverless.service
        .provider.compiledCloudFormationTemplate.Resources
        .FirstStepFunctionsSchedulerSchedule1
        .Properties.Description).to.equal('your scheduled event description');
    });

    it('should respect end_date variable', () => {
      serverlessStepFunctions.serverless.service.stepFunctions = {
        stateMachines: {
          first: {
            events: [
              {
                schedule: {
                  rate: 'rate(10 minutes)',
                  enabled: false,
                  end_date: '2023-01-01',
                },
              },
            ],
          },
        },
      };

      serverlessStepFunctions.compileScheduledEvents();

      expect(serverlessStepFunctions.serverless.service
        .provider.compiledCloudFormationTemplate.Resources
        .FirstStepFunctionsSchedulerSchedule1
        .Properties.EndDate).to.equal('2023-01-01');
    });

    it('should respect start_date variable', () => {
      serverlessStepFunctions.serverless.service.stepFunctions = {
        stateMachines: {
          first: {
            events: [
              {
                schedule: {
                  rate: 'rate(10 minutes)',
                  enabled: false,
                  start_date: '2023-01-01',
                },
              },
            ],
          },
        },
      };

      serverlessStepFunctions.compileScheduledEvents();

      expect(serverlessStepFunctions.serverless.service
        .provider.compiledCloudFormationTemplate.Resources
        .FirstStepFunctionsSchedulerSchedule1
        .Properties.StartDate).to.equal('2023-01-01');
    });

    it('should respect group_name variable', () => {
      serverlessStepFunctions.serverless.service.stepFunctions = {
        stateMachines: {
          first: {
            events: [
              {
                schedule: {
                  rate: 'rate(10 minutes)',
                  enabled: false,
                  group_name: 'my group',
                },
              },
            ],
          },
        },
      };

      serverlessStepFunctions.compileScheduledEvents();

      expect(serverlessStepFunctions.serverless.service
        .provider.compiledCloudFormationTemplate.Resources
        .FirstStepFunctionsSchedulerSchedule1
        .Properties.GroupName).to.equal('my group');
    });

    it('should respect kms_key_arn variable', () => {
      serverlessStepFunctions.serverless.service.stepFunctions = {
        stateMachines: {
          first: {
            events: [
              {
                schedule: {
                  rate: 'rate(10 minutes)',
                  enabled: false,
                  kms_key_arn: 'arn::kms::test',
                },
              },
            ],
          },
        },
      };

      serverlessStepFunctions.compileScheduledEvents();

      expect(serverlessStepFunctions.serverless.service
        .provider.compiledCloudFormationTemplate.Resources
        .FirstStepFunctionsSchedulerSchedule1
        .Properties.KmsKeyArn).to.equal('arn::kms::test');
    });

    it('should respect input variable', () => {
      serverlessStepFunctions.serverless.service.stepFunctions = {
        stateMachines: {
          first: {
            events: [
              {
                schedule: {
                  rate: 'rate(10 minutes)',
                  enabled: false,
                  input: '{"key":"value"}',
                },
              },
            ],
          },
        },
      };

      serverlessStepFunctions.compileScheduledEvents();

      expect(serverlessStepFunctions.serverless.service
        .provider.compiledCloudFormationTemplate.Resources
        .FirstStepFunctionsSchedulerSchedule1
        .Properties.Target.Input).to.equal('{"key":"value"}');
    });

    it('should respect input variable as an object', () => {
      serverlessStepFunctions.serverless.service.stepFunctions = {
        stateMachines: {
          first: {
            events: [
              {
                schedule: {
                  rate: 'rate(10 minutes)',
                  enabled: false,
                  input: {
                    key: 'value',
                  },
                },
              },
            ],
          },
        },
      };

      serverlessStepFunctions.compileScheduledEvents();

      expect(serverlessStepFunctions.serverless.service
        .provider.compiledCloudFormationTemplate.Resources
        .FirstStepFunctionsSchedulerSchedule1
        .Properties.Target.Input).to.equal('{"key":"value"}');
    });

    it('should respect role variable', () => {
      serverlessStepFunctions.serverless.service.stepFunctions = {
        stateMachines: {
          first: {
            events: [
              {
                schedule: {
                  rate: 'rate(10 minutes)',
                  enabled: false,
                  role: 'arn:aws:iam::000000000000:role/test-role',
                },
              },
            ],
          },
        },
      };

      serverlessStepFunctions.compileScheduledEvents();

      expect(serverlessStepFunctions.serverless.service
        .provider.compiledCloudFormationTemplate.Resources
        .FirstScheduleToStepFunctionsRole).to.equal(undefined);

      expect(serverlessStepFunctions.serverless.service
        .provider.compiledCloudFormationTemplate.Resources.FirstStepFunctionsSchedulerSchedule1
        .Properties.Target.RoleArn).to.equal('arn:aws:iam::000000000000:role/test-role');
    });

    it('should not create corresponding resources when scheduled events are not given', () => {
      serverlessStepFunctions.serverless.service.stepFunctions = {
        stateMachines: {
          first: {
          },
        },
      };

      serverlessStepFunctions.compileScheduledEvents();

      expect(
        serverlessStepFunctions.serverless.service.provider.compiledCloudFormationTemplate
          .Resources,
      ).to.deep.equal({});

      serverlessStepFunctions.serverless.service.stepFunctions = {
        stateMachines: {
          first: {
            events: [
              'schedule',
            ],
          },
        },
      };

      serverlessStepFunctions.compileScheduledEvents();

      expect(
        serverlessStepFunctions.serverless.service.provider.compiledCloudFormationTemplate
          .Resources,
      ).to.deep.equal({});
    });
  });
});
