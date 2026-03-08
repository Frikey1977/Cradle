import {
  ExpValidate
} from '@/utils/validate'

const Validation = {
  sid: [{
    requird: true,
    trigger: 'change',
    validator: function(validation, value, callback) {
      ExpValidate(validation.rules, value, callback)
    },
    rules: [{
      regulation: '^.{0,36}$',
      message: '输入内容超过36字符'
    },
    {
      regulation: '^\\s{0}$|^[a-zA-Z0-9()（）\\u4e00-\\u9fa5]+$',
      message: '请输入正确的内容，符号只可以包含（）'
    }
    ]
  }],
  name: [{
    requird: false,
    trigger: 'blur',
    validator: function(validation, value, callback) {
      ExpValidate(validation.rules, value, callback)
    },
    rules: [{
      regulation: 'notNull',
      message: '不可空'
    }, {
      regulation: '^.{1,100}$',
      message: '可输入内容为2~100字符'
    },
    {
      regulation: '^[a-zA-Z0-9<>=()\'+（）%，,/\\-—\\u4e00-\\u9fa5]+$',
      message: '请输入正确的内容'
    }
    ]
  }],
  name_en: [{
    requird: false,
    trigger: 'blur',
    validator: function(validation, value, callback) {
      ExpValidate(validation.rules, value, callback)
    },
    rules: [{
      regulation: 'notNull',
      message: '不可空'
    }, {
      regulation: '^.{1,100}$',
      message: '可输入内容为2~100字符'
    },
    {
      regulation: '^[a-zA-Z0-9<>=()\'+（）%，,/\\-—\\u4e00-\\u9fa5]+$',
      message: '请输入正确的内容'
    }
    ]
  }],
  sort: [{
    requird: false,
    trigger: 'blur',
    validator: function(validation, value, callback) {
      ExpValidate(validation.rules, value, callback)
    },
    rules: [{
      regulation: '^[0-9]+$',
      message: '可输入内容仅为数字'
    }]
  }],
  value: [{
    requird: false,
    trigger: 'blur',
    validator: function(validation, value, callback) { ExpValidate(validation.rules, value, callback) },
    rules: [{
      regulation: 'notNull',
      message: '不可空'
    }, {
      regulation: '^[a-zA-Z0-9（）()!@%\\*\\[\\]\\-{}:;,\\.\\\\_/<>?=&\\u4e00-\\u9fa5]+$',
      message: '请输入正确的内容，不可以包含符号'
    }]
  }],
  comment: [{
    requird: false,
    trigger: 'blur',
    validator: function(validation, value, callback) {
      ExpValidate(validation.rules, value, callback)
    },
    rules: [{
      regulation: 'nullable',
      message: '可以为空'
    }, {
      regulation: '^[a-zA-Z0-9（）()!@%\\*\\[\\]\\-{}:;,\\.\\\\_/<>?=&\\u4e00-\\u9fa5]+$',
      message: '请输入正确的内容，可以包含常规符号'
    }]
  }],
  createTime: [{
    requird: false,
    trigger: 'blur',
    validator: function(validation, value, callback) {
      ExpValidate(validation.rules, value, callback)
    },
    rules: []
  }],
  status: [{
    requird: false,
    trigger: 'change',
    validator: function(validation, value, callback) {
      ExpValidate(validation.rules, value, callback)
    },
    rules: [{
      regulation: 'notNull',
      message: '请选择'
    }, {
      regulation: '^[0-9]+$',
      message: '选项不正确'
    }]
  }],
  parentID: [{
    requird: false,
    trigger: 'change',
    validator: function(validation, value, callback) {
      ExpValidate(validation.rules, value, callback)
    },
    rules: [{
      regulation: '^.{0,36}$',
      message: '输入内容超过36字符'
    },
    {
      regulation: '^\\s{0}$|^[a-zA-Z0-9()（）\\u4e00-\\u9fa5]+$',
      message: '请输入正确的内容，符号只可以包含（）'
    }
    ]
  }],
  catalog: [{
    requird: false,
    trigger: 'change',
    validator: function(validation, value, callback) {
      ExpValidate(validation.rules, value, callback)
    },
    rules: [{
      regulation: '^\\s{0}$|^[a-zA-Z0-9()（）\\-\\u4e00-\\u9fa5]+$',
      message: '请输入正确的内容'
    }]
  }],
  organizationID: [{
    requird: false,
    trigger: 'change',
    validator: function(validation, value, callback) {
      ExpValidate(validation.rules, value, callback)
    },
    rules: [{
      regulation: '^.{0,36}$',
      message: '输入内容超过36字符'
    },
    {
      regulation: '^\\s{0}$|^[a-zA-Z0-9()（）\\u4e00-\\u9fa5]+$',
      message: '请输入正确的内容，符号只可以包含（）'
    }
    ]
  }]
}

export default Validation
