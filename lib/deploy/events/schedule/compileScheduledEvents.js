'use strict';

const _ = require('lodash');
const BbPromise = require('bluebird');

module.exports = {
  compileScheduledEvents() {
    _.forEach(this.getAllStateMachines(), (stateMachineName) => {
      const stateMachineObj = this.getStateMachine(stateMachineName);
      let scheduleNumberInFunction = 0;

      if (stateMachineObj.events) {
        _.forEach(stateMachineObj.events, (event) => {
          if (event.schedule) {
            scheduleNumberInFunction++;
            let ScheduleExpression;
            let ScheduleExpressionTimezone;
            let State;
            let Input;
            let Name;
            let Description;
            let EndDate;
            let StartDate;
            let FlexTimeWindowMode;
            let MaximumWindowInMinutes;
            let GroupName;
            let KmsKeyArn;

            // TODO validate rate syntax
            if (typeof event.schedule === 'object') {
              if (!event.schedule.rate) {
                const errorMessage = [
                  `Missing "rate" property for schedule event in stateMachine ${stateMachineName}`,
                  ' The correct syntax is: schedule: rate(10 minutes)',
                  ' OR an object with "rate" property.',
                  ' Please check the README for more info.',
                ].join('');
                throw new this.serverless.classes
                  .Error(errorMessage);
              }
              ScheduleExpression = event.schedule.rate;
              ScheduleExpressionTimezone = event.schedule.timezone;
              EndDate = event.schedule.end_date;
              StartDate = event.schedule.start_date;
              GroupName = event.schedule.group_name;
              KmsKeyArn = event.schedule.kms_key_arn;

              FlexTimeWindowMode = 'OFF';

              if (event.schedule.flex_time_window) {
                FlexTimeWindowMode = 'FLEXIBLE';
                MaximumWindowInMinutes = event.schedule.flex_time_window;
              }

              State = 'ENABLED';

              if (event.schedule.enabled === false) {
                State = 'DISABLED';
              }

              Input = event.schedule.input;
              Name = event.schedule.name;
              Description = event.schedule.description;

              if (Input && typeof Input === 'object') {
                Input = JSON.stringify(Input);
              }
              if (Input && typeof Input === 'string') {
                // escape quotes to favor JSON.parse
                Input = Input.replace(/\"/g, '\\"'); // eslint-disable-line
              }
            } else if (typeof event.schedule === 'string') {
              ScheduleExpression = event.schedule;
              State = 'ENABLED';
            } else {
              const errorMessage = [
                `Schedule event of stateMachine ${stateMachineName} is not an object nor a string`,
                ' The correct syntax is: schedule: rate(10 minutes)',
                ' OR an object with "rate" property.',
                ' Please check the README for more info.',
              ].join('');
              throw new this.serverless.classes
                .Error(errorMessage);
            }

            const stateMachineLogicalId = this
              .getStateMachineLogicalId(stateMachineName, stateMachineObj);
            const scheduleLogicalId = this
              .getScheduleLogicalId(stateMachineName, scheduleNumberInFunction);
            const scheduleIamRoleLogicalId = this
              .getScheduleToStepFunctionsIamRoleLogicalId(stateMachineName);
            const policyName = this.getSchedulePolicyName(stateMachineName);

            const roleArn = event.schedule.role
              ? JSON.stringify(event.schedule.role)
              : `
                {
                  "Fn::GetAtt": [
                    "${scheduleIamRoleLogicalId}",
                    "Arn"
                  ]
                }
              `;

            const scheduleTemplate = `
              {
                "Type": "AWS::Scheduler::Schedule",
                "Properties": {
                  ${Description ? `"Description": "${Description}",` : ''}
                  ${EndDate ? `"EndDate": "${EndDate}",` : ''}
                  "FlexibleTimeWindow": {
                    ${MaximumWindowInMinutes ? `"MaximumWindowInMinutes": ${MaximumWindowInMinutes},` : ''}
                    "Mode": "${FlexTimeWindowMode}"
                  },
                  ${GroupName ? `"GroupName": "${GroupName}",` : ''}
                  ${KmsKeyArn ? `"KmsKeyArn": "${KmsKeyArn}",` : ''}
                  ${Name ? `"Name": "${Name}",` : ''}
                  "ScheduleExpression": "${ScheduleExpression}",
                  ${ScheduleExpressionTimezone ? `"ScheduleExpressionTimezone": "${ScheduleExpressionTimezone}",` : ''}
                  ${StartDate ? `"StartDate": "${StartDate}",` : ''}
                  "State": "${State}",
                  "Target": {
                    "Arn": { "Ref": "${stateMachineLogicalId}" },
                    ${Input ? `"Input": "${Input}",` : ''}
                    "RoleArn": ${roleArn}
                  }
                }
              }
            `;

            const iamRoleTemplate = `
            {
              "Type": "AWS::IAM::Role",
              "Properties": {
                "AssumeRolePolicyDocument": {
                  "Version": "2012-10-17",
                  "Statement": [
                    {
                      "Effect": "Allow",
                      "Principal": {
                        "Service": "scheduler.amazonaws.com"
                      },
                      "Action": "sts:AssumeRole"
                    }
                  ]
                },
                "Policies": [
                  {
                    "PolicyName": "${policyName}",
                    "PolicyDocument": {
                      "Version": "2012-10-17",
                      "Statement": [
                        {
                          "Effect": "Allow",
                          "Action": [
                            "states:StartExecution"
                          ],
                          "Resource": {
                            "Ref": "${stateMachineLogicalId}"
                          }
                        }
                      ]
                    }
                  }
                ]
              }
            }
            `;

            const newScheduleObject = {
              [scheduleLogicalId]: JSON.parse(scheduleTemplate),
            };

            const newPermissionObject = event.schedule.role ? {} : {
              [scheduleIamRoleLogicalId]: JSON.parse(iamRoleTemplate),
            };

            _.merge(this.serverless.service.provider.compiledCloudFormationTemplate.Resources,
              newScheduleObject, newPermissionObject);
          }
        });
      }
    });
    return BbPromise.resolve();
  },
};
