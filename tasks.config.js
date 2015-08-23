module.exports = {
  catalog: {
    activate: {
      "HR": [
        {
          name: "Complete your benefits enrollment",
          note: "Launch your benefits portal http://rain.okta1.com:1802/home/blueshieldca/0oaavdpiHK9RkGO1e0g4/1344",
          dueDays: 5,
          tags: [
            'HR',
            'Benefits'
          ]
        },
        {
          name: "Enroll in direct deposit with ADP",
          note: "Launch your payroll portal http://rain.okta1.com:1802/home/adp_workforce_now/0oaavd5sH2XMpM6QH0g4/1657",
          dueDays: 5,
          tags: [
            'HR',
            'Payroll'
          ]
        },
        {
          name: "Update your Workday profile",
          note: "Goto your workday profile http://rain.okta1.com:1802/home/workday/0oa3hmzAGGUq9aVIi0g4/15",
          dueDays: 5,
          tags: [
            'HR'
          ]
        }
      ],
      "IT": [
        {
          name: "Get your phone enrolled in Okta Mobile for email and company apps",
          note: "Download from the appstore and launch Okta mobile",
          dueDays: 0,
          tags: [
            'IT',
            'Mobile'
          ]
        },
        {
          name: "Enroll Okta Verify with Push for remote authentication",
          note: "Download from the appstore and launch Okta Verify",
          dueDays: 0,
          tags: [
            'IT',
            'Mobile'
          ]
        }
      ],
      "Engineering": [
        {
          name: "Setup your dev environment",
          note: "Details can be found on the wiki",
          dueDays: 1,
          tags: [
            'Engineering',
            'DevEnv'
          ]
        },
        {
          name: "Setup your Okta github.com account",
          note: "Details can be found on the wiki",
          dueDays: 1,
          tags: [
            'Engineering'
          ],
          triggers: {
            completed: [
              {
                action: "task",
                target: "asana",
                targetType: "api",
                data: {
                  assignee: 'fits@janky.co',
                  name: "Provision github.com account for <%= resource.name %>",
                  note: "Please add the the github.com user to the Okta organization",
                  dueDays: 1,
                  tags: [
                    'Engineering'
                  ],
                  project: "App Requests",
                  triggers: {
                    completed: [
                      {
                        action: "assign",
                        target: "github",
                        targetType: "app",
                        data: {}
                      }
                    ]
                  }
                }
              }
            ]
          }
        },
        {
          name: "Fix your first defect",
          note: "Details can be found on the wiki",
          dueDays: 5,
          tags: [
            'Engineering',
          ]
        }
      ],
      "Product": [
        {
          name: "Schedule intro meetings with each PM team member",
          note: "",
          dueDays: 1,
          tags: [
            'Product'
          ]
        },
        {
          name: "Watch Identity @ Okta presentations",
          note: "Link to box goes here",
          dueDays: 5,
          tags: [
            'Product',
            'Presentation'
          ]
        }
      ]
    },
    deactivate: {
      "IT": [
        {
          assignee: 'fits@janky.co',
          name: "Backup local data from <%= resource.name %>'s laptop",
          note: "",
          dueDays: 0,
          tags: [
          ],
          project: "Terminations"
        },
        {
          assignee: 'fits@janky.co',
          name: "Assign content in <%= resource.name %>'s box.net personal folders to manager",
          note: "",
          dueDays: 0,
          tags: [
          ],
          project: "Terminations"
        },
        {
          assignee: 'fits@janky.co',
          name: "Kill <%= resource.name %>'s badge access to all Okta offices",
          note: "",
          dueDays: 0,
          tags: [
          ],
          project: "Terminations"
        }
      ]
    }
  },
  apps: {
    "github": "0oaaty0FixWxppi9h0g4",
    "asana": "0oaars5sOhReW8Nbd0g4"
  },
  projects: {
    "App Requests": 45641235937874,
    "Terminations": 45641235937880
  },
  users: {
    "fits@janky.co": 45663783090608
  },
  tags: {
    "Benefits": 45666927432143,
    "Payroll": 45666927432141,
    "Mobile": 45666927432139,
    "App Request": 45666927432137,
    "Product": 45666927432135,
    "Engineering": 45666927432133,
    "IT": 45666927432131,
    "HR": 45666927432129,
    "DevEnv": 45668620546390,
    "Presentation": 45668620546392
  },
  hooks: {
    completed: {}
  }
};
