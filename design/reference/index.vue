<template>
  <div class="app-container">
    <el-container>
      <el-aside width="240px" style="height:650px">
        <el-tabs type="border-card" style="width:100%;height:100%" @tab-click="handleTabClick">
          <el-tab-pane
            v-for="item in Tree"
            :key="item.code"
            :label="item.label"
            :label-content="item.code"
          >
            <span slot="label">{{ item.label }}</span>
            <div style="height:600px;">
              <el-scrollbar style="height:100%">
                <el-tree
                  :data="item.children"
                  :filter-node-method="handleChange"
                  :props="defaultProps"
                  default-expand-all
                  :expand-on-click-node="false"
                  :check-on-click-node="true"
                  draggable
                  :allow-drop="allowDrop"
                  :allow-drag="allowDrag"
                  @node-click="handleNodeClick"
                />
              </el-scrollbar>
            </div>
          </el-tab-pane>
        </el-tabs>
      </el-aside>
      <el-main>
        <div class="query-container">
          <div
            v-for="(query,i) in Tablefields"
            v-if="query.queryable"
            :key="i"
            class="query-row"
            :style="'width:' + (query.width + 130) + 'px;'"
          >
            <div class="query-title">{{ query.title }}:</div>
            <div v-if="query.present === 'datetime' " class="query-content">
              <el-date-picker
                v-model="query.queryValue"
                type="daterange"
                range-separator="至"
                start-placeholder="开始日期"
                end-placeholder="结束日期"
                @change="query.handleChange"
              />
            </div>
            <div v-else-if="query.present === 'selection' " class="query-content">
              <el-select
                v-model="query.queryValue"
                placeholder="选择筛选字段"
                default-first-option
                clearable
                :multiple="query.codeRemote"
                :remote="query.codeRemote"
                :filterable="query.codeRemote"
                :allow-create="query.codeCreate"
                reserve-keyword
                :remote-method="query.remoteMethod"
                :loading="loading"
                class="filter-item"
                :style="'width:' + (query.width) + 'px;'"
                @change="query.handleChange"
              >
                <el-option
                  v-for="item in query.codeSource"
                  :key="item.key"
                  :label="item.label"
                  :value="item.key"
                />
              </el-select>
            </div>

            <div v-else-if="query.present === 'checkbox' " class="query-content">
              <el-checkbox-group v-model="query.queryValue">
                <el-checkbox
                  v-for="item in query.codeSource"
                  :key="item.key"
                  clearable
                  :label="item.label"
                  @change="query.handleChange"
                >{{ item.label }}</el-checkbox>
              </el-checkbox-group>
            </div>

            <div v-else-if="query.present === 'cascader' " class="query-content">
              <el-cascader
                v-model="query.queryValue"
                :options="query.codeSource"
                clearable
                :props="{ expandTrigger: 'hover' }"
                @change="query.handleChange"
              />
            </div>
            <div v-else-if="query.present === 'radio' " class="query-content">
              <el-radio
                v-for="item in query.codeSource"
                :key="item.key"
                v-model="query.queryValue"
                clearable
                :label="item.key"
                @change="query.handleChange"
              >{{ item.label }}</el-radio>
            </div>
            <div v-else class="query-content">
              <el-input
                v-model="query.queryValue"
                :placeholder="'请输入'+ query.title"
                :style="'width:' + query.width + 'px;'"
                class="filter-item"
                clearable
                @change="query.handleChange"
                @keyup.enter.native="handleFilter"
              />
            </div>
          </div>
          <!-----------------------------业务数据功能-------------------------------------->
          <div class="action-row">
            <el-button-group>
              <el-tooltip content="刷新数据" placement="bottom">
                <el-button
                  v-waves
                  class="filter-item"
                  type="primary"
                  icon="el-icon-refresh"
                  @click="handleRefresh"
                >刷新</el-button>
              </el-tooltip>

              <el-tooltip content="新增代码" placement="bottom">
                <el-button
                  class="filter-item"
                  type="primary"
                  icon="el-icon-document"
                  @click="handleAdd"
                >新建</el-button>
              </el-tooltip>

              <el-tooltip content="删除代码" placement="bottom">
                <el-button
                  class="filter-item"
                  type="primary"
                  icon="el-icon-delete"
                  @click="handleBatchDelete"
                >删除</el-button>
              </el-tooltip>

              <el-tooltip content="清理缓存" placement="bottom">
                <el-button
                  class="filter-item"
                  type="primary"
                  icon="el-icon-download"
                  @click="ClearCache"
                >清理缓存</el-button>
              </el-tooltip>
            </el-button-group>
          </div>
          <!-----------------------------业务数据列表-------------------------------------->
          <el-table
            :ref="multipleTable"
            v-loading="loading"
            :data="Rows"
            :row-style="{height:'40px'}"
            :cell-style="{padding:'0px'}"
            style="width:100%;margin-top:10px;"
            class="query-container"
            @row-dblclick="handleRowDbclick"
            @selection-change="handleSelectionChange"
          >
            <el-table-column
              fixed="left"
              type="selection"
              width="45"
              :show-overflow-tooltip="false"
            />
            <el-table-column fixed="left" type="expand" width="40">
              <template slot-scope="scope">
                <el-form label-position="left" inline>
                  <el-form-item label="代码描述：">
                    <span>{{ scope.row.description }}</span>
                  </el-form-item>
                </el-form>
              </template>
            </el-table-column>
            <template v-for="field in Tablefields">
              <el-table-column
                v-if="field.listable"
                :key="field.name"
                :fixed="field.fixed"
                :prop="field.name"
                :label="field.title"
                :width="field.tableWidth"
                :resizable="field.resizable"
                :show-overflow-tooltip="true"
              >
                <template slot-scope="scope">
                  <div v-html="columnFormatter(scope.row[field.name],field)" />
                </template>
              </el-table-column>
            </template>
            <el-table-column align="center" label="操作" width="130" fixed="right">
              <template slot-scope="scope">
                <el-button type="primary" icon="el-icon-edit" circle @click="handleEdit(scope)" />
                <el-button type="danger" icon="el-icon-delete" circle @click="handleDelete(scope)" />
              </template>
            </el-table-column>
          </el-table>
          <div class="block" style="padding:15px;text-align:right;">
            <el-pagination
              :current-page="Query.pageIndex"
              :page-sizes="[10, 20, 30, 40, 50]"
              :page-size="Query.pageSize"
              layout="total, sizes, prev, pager, next"
              :total="Query.total"
              @size-change="handleSizeChange"
              @current-change="handlePageChange"
            />
          </div>
          <!-----------------------------创建&编辑对话框------------------------------>

          <el-drawer
            ref="drawer"
            v-loading="loading"
            :show-close="false"
            size="500"
            :visible.sync="Dialog.visible"
            direction="rtl"
            :before-close="handleClose"
            :title="Dialog.type==='edit'?'维护代码':'新增代码'"
          >
            <el-tabs type="border-card" style="width:700px;height:100%">
              <el-tab-pane>
                <span slot="label">
                  <i class="el-icon-date" /> 代码信息
                </span>
                <div style="padding:15px;position:fixed;top:0;text-align:right;width:680px">
                  <el-button type="primary" @click="Dialog.visible=false">取 消</el-button>
                  <el-button
                    type="primary"
                    :loading="loading"
                    @click="$refs.drawer.closeDrawer()"
                  >{{ loading ? '提交中 ...' : '确 定' }}</el-button>
                </div>
                <div style="height:600px;margin-top:10px;">
                  <el-scrollbar style="height:100%">
                    <el-form
                      ref="EditForm"
                      :model="Form"
                      label-width="80px"
                      :inline="true"
                      class="demo-form-inline"
                      :rules="Validation"
                      autocomplete="on"
                    >
                      <div v-for="(query,i) in Tablefields" :key="i">
                        <div v-if="query.creatable">
                          <el-form-item
                            v-if="query.present === 'datetime' "
                            :label="query.title"
                            :prop="query.name"
                          >
                            <el-date-picker
                              v-model="query.formValue"
                              type="daterange"
                              range-separator="至"
                              start-placeholder="开始日期"
                              end-placeholder="结束日期"
                              @change="query.handleChange"
                            />
                          </el-form-item>

                          <el-form-item
                            v-else-if="query.present === 'selection' "
                            :label="query.title"
                            :prop="query.name"
                          >
                            <el-select
                              v-model="query.formValue"
                              placeholder="选择筛选字段"
                              default-first-option
                              clearable
                              :multiple="query.codeRemote"
                              :remote="query.codeRemote"
                              :filterable="query.codeRemote"
                              :allow-create="query.codeCreate"
                              reserve-keyword
                              :remote-method="query.remoteMethod"
                              :loading="loading"
                              class="filter-item"
                              :style="'width:' + (query.width) + 'px;'"
                              @change="query.handleChange"
                            >
                              <el-option
                                v-for="item in query.codeSource"
                                :key="item.key"
                                :label="item.label"
                                :value="item.key"
                              />
                            </el-select>
                          </el-form-item>

                          <el-form-item
                            v-else-if="query.present === 'checkbox' "
                            :label="query.title"
                            :prop="query.name"
                          >
                            <el-checkbox-group v-model="query.formValue">
                              <el-checkbox
                                v-for="item in query.codeSource"
                                :key="item.key"
                                :label="item.label"
                                @change="query.handleChange"
                              >{{ item.label }}</el-checkbox>
                            </el-checkbox-group>
                          </el-form-item>

                          <el-form-item
                            v-else-if="query.present === 'cascader' "
                            :label="query.title"
                            :prop="query.name"
                          >
                            <el-cascader
                              v-model="query.formValue"
                              :style="'width:' + (query.width) + 'px;'"
                              :options="query.codeSource"
                              :props="{ expandTrigger: 'hover' ,value:'code',checkStrictly: true }"
                              @change="query.handleChange"
                            />
                          </el-form-item>

                          <el-form-item
                            v-else-if="query.present === 'radio' "
                            :label="query.title"
                            :prop="query.name"
                          >
                            <el-radio
                              v-for="item in query.codeSource"
                              :key="item.key"
                              v-model="query.formValue"
                              :label="item.key"
                              @change="query.handleChange"
                            >{{ item.label }}</el-radio>
                          </el-form-item>
                          <el-form-item v-else :label="query.title" :prop="query.name">
                            <el-input
                              v-model="query.formValue"
                              :placeholder="'请输入'+ query.title"
                              :style="'width:' + query.width + 'px;'"
                              class="filter-item"
                              @change="query.handleChange"
                            />
                          </el-form-item>
                        </div>
                      </div>
                    </el-form>
                  </el-scrollbar>
                  <div
                    class="block"
                    style="padding:15px;position:fixed;bottom:0;text-align:right;width:680px"
                  >
                    <el-button type="primary" @click="Dialog.visible=false">取 消</el-button>
                    <el-button
                      type="primary"
                      :loading="loading"
                      @click="$refs.drawer.closeDrawer()"
                    >{{ loading ? '提交中 ...' : '确 定' }}</el-button>
                  </div>
                </div>
              </el-tab-pane>
            </el-tabs>
          </el-drawer>
        </div>
      </el-main>
    </el-container>
  </div>
</template>

<script>
import { sortBykey } from '@/utils/sort'
import { deepClone } from '@/utils'
import {
  getCodes,
  addCodes,
  deleteCodes,
  updateCodes,
  queryCodes,
  queryTree,
  getCodeList,
  ClearCodes,
} from '@/api/code'
import { indexOf } from '@/utils/string'
import { defaultForm, defaultQuery } from './include/default'
import Fields from './include/fields'
import Validation from './include/validation'
var GlogbalObj = {}
window.GlogbalObj = GlogbalObj

export default {
  data() {
    return {
      Environment: {
        node: '',
      },
      Fields: Fields,
      Validation: Validation,
      Rows: [],
      Form: Object.assign({}, defaultForm),
      Query: Object.assign({}, defaultQuery),
      Tree: [],
      Table: {
        height: window.innerHeight - 300,
        formChanged: false,
        multipleSelection: [],
      },
      Dialog: {
        visible: false,
        type: 'new',
      },
      loading: false,
      defaultProps: {
        children: 'children',
        label: 'label',
      },
    }
  },
  computed: {
    routesData() {
      return this.routes
    },

    Tablefields() {
      return sortBykey(this.Fields, 'position')
    },
  },
  beforeCreate() {
    GlogbalObj = this
    window.GlogbalObj = this
  },
  mounted() {
    this.list = this.states.map((item) => {
      return { value: item, label: item }
    })
  },
  created() {
    // Mock: get all routes and roles list from server
    this.getCodes()
    this.queryTree('1089764a91421000')
    this.getCodeList()
  },
  methods: {
    ClearCache() {
      this.loading = true
      ClearCodes(this.Query.parentID)
      this.queryTree('1089764a91421000')
      this.$message({
        type: 'success',
        message: '缓存清理完成！',
      })
      this.loading = false
    },
    columnFormatter(value, fields) {
      if (value === null || value === '' || value === undefined) {
        return
      }

      if (fields.isCode) {
        var recursiver = function (nodes, value) {
          try {
            var result = ''
            var targetKey
            var hasChilern = value.indexOf(',') > -1

            if (nodes === null || nodes === '' || nodes === undefined) {
              return value
            }

            if (hasChilern) {
              targetKey = value.substring(0, value.indexOf(','))
            } else {
              targetKey = value
            }

            var target = nodes.filter(function (item) {
              if (item.key === targetKey) {
                return item.label
              }
            })

            if (target.length === 0) {
              return value
            }

            if (hasChilern) {
              result =
                '/' +
                recursiver(
                  target[0].children,
                  value.substring(value.indexOf(',') + 1)
                )
            }
            return target[0].label + result
          } catch (ex) {
            console.log(ex)
          }
        }

        return recursiver(fields.codeSource, value)
      }
      return value
    },
    handleTabClick(tab) {
      this.Query.levelID = tab.labelContent
      this.Query.parentID = tab.labelContent
      this.Environment.RootID = tab.labelContent

      return new Promise((resolve, reject) => {
        const result = queryCodes(this.Query)
        resolve(result)
      }).then((res) => {
        this.Rows = res.data.list
        this.Query.pageIndex = res.data.pageIndex
        this.Query.pageSize = res.data.pageSize
        this.Query.pageCount = res.data.pageCount
        this.Query.total = res.data.total
      })
    },
    handleNodeClick(data, node, tree) {
      var recursiver = function (node, value) {
        try {
          if (
            node.parent !== null &&
            node.parent !== undefined &&
            node.parent !== ''
          ) {
            return recursiver(node.parent, node.data.code + ',' + value)
          } else {
            return value
          }
        } catch (ex) {
          console.log(ex)
        }
      }

      this.Query.levelID =
        this.Environment.RootID + ',' + recursiver(node.parent, data.code)
      // 选择节点保存下来
      this.Environment.node = node
      this.Query.parentID = data.code
      return new Promise((resolve, reject) => {
        const result = queryCodes(this.Query)
        resolve(result)
      }).then((res) => {
        this.Rows = res.data.list
        this.Query.pageIndex = res.data.pageIndex
        this.Query.pageSize = res.data.pageSize
        this.Query.pageCount = res.data.pageCount
        this.Query.total = res.data.total
      })
    },
    async handleSizeChange(value) {
      this.loading = true
      this.Query.pageSize = value
      const res = await queryCodes(this.Query)
      this.Rows = res.data.list
      this.Query.pageIndex = res.data.pageIndex
      this.Query.pageSize = res.data.pageSize
      this.Query.pageCount = res.data.pageCount
      this.Query.total = res.data.total
      this.loading = false
    },
    async handlePageChange(value) {
      this.loading = true
      this.Query.pageIndex = value
      const res = await queryCodes(this.Query)
      this.Rows = res.data.list
      this.Query.pageIndex = res.data.pageIndex
      this.Query.pageSize = res.data.pageSize
      this.Query.pageCount = res.data.pageCount
      this.Query.total = res.data.total
      this.loading = false
    },
    async handleChange(value, name) {
      if (this.Dialog.visible) {
        // 变化来自新增、编辑表单，保存变化到Form
        GlogbalObj.Form[name] = value
      } else {
        // 变化来自查询表单,保存变化到Query
        this.Query[name] = value
        this.loading = true
        const res = await queryCodes(this.Query)
        this.Rows = res.data.list
        this.Query.pageIndex = res.data.pageIndex
        this.Query.pageSize = res.data.pageSize
        this.Query.pageCount = res.data.pageCount
        this.Query.total = res.data.total
        this.loading = false
      }
      // this.$refs.EditForm.validate()
      this.Table.formChanged = true
    },
    handleClose(done) {
      this.$refs['EditForm'].validate((valid) => {
        if (valid) {
          if (this.Table.formChanged) {
            this.$confirm('表单已经修改，需要提交表单吗？')
              .then((_) => {
                this.loading = true
                GlogbalObj.SubmitForm(done)
                this.loading = false
              })
              .catch((_) => {})
            this.Table.formChanged = false
          } else {
            done()
          }
        } else {
          this.$notify({
            title: '提示',
            dangerouslyUseHTMLString: true,
            message: `请将表单填写完整`,
            type: 'warning',
          })
          console.log('error submit!!')
          return false
        }
      })
    },
    async getCodeList() {
      var str = ''
      var split = false
      this.Fields.forEach((item) => {
        if (item.codeSID !== '' && item.codeSID !== null) {
          if (split) {
            str += ','
          }
          str += item.codeSID
          split = true
        }
      })
      const res = await getCodeList(str)
      // 找到每个Fields，的Codesource，填充进去
      res.data.forEach((item) => {
        this.Fields[indexOf(Fields, 'codeSID', item.label)].codeSource =
          item.children
      })
    },
    async getCodes() {
      const res = await getCodes()
      this.Rows = res.data.list
      this.Query.pageIndex = res.data.pageIndex
      this.Query.pageSize = res.data.pageSize
      this.Query.pageCount = res.data.pageCount
      this.Query.total = res.data.total
    },
    async queryTree(node) {
      const res = await queryTree(node)
      this.Tree = res.data[0].children
    },
    handleSelectionChange(val) {
      this.Table.multipleSelection = val
    },
    async handleRefresh() {
      this.loading = true
      this.Query = deepClone(defaultQuery)
      // 循环目标对象
      for (const [key, value] of Object.entries(this.Query)) {
        // 找到fileds数组中的目标字段对象
        const objField = this.Fields.filter(function (item) {
          return item.name.match(key)
        })
        if (objField.length > 0) {
          objField[0].queryValue = value
        }
      }
      const res = await queryCodes(this.Query)
      this.Rows = res.data.list
      this.Query.pageIndex = res.data.pageIndex
      this.Query.pageSize = res.data.pageSize
      this.Query.pageCount = res.data.pageCount
      this.Query.total = res.data.total
      this.loading = false
    },
    handleAdd() {
      if (this.Query.parentID === '' || this.Query.parentID === null) {
        this.$message({
          message: '请选择即将创建代码的父级节点',
          type: 'warning',
        })
        return
      }
      this.Dialog.type = 'new'
      this.Dialog.visible = true
      // 清除表单校验的提示
      if (this.$refs['EditForm']) {
        // 延时执行
        this.$nextTick(function () {
          this.$refs['EditForm'].clearValidate()
        })
      }
      // 更新Form对象
      this.Form = Object.assign({}, defaultForm)
      this.Form.parentID = this.Query.parentID
      this.Form.levelID = this.Query.levelID

      // 遍历Form对象，更新formValue
      for (var key in this.Form) {
        // 找到fileds数组中的目标字段对象
        const objField = this.Fields.filter(function (item) {
          if (item.name === key) {
            return item
          }
        })

        if (objField[0].multiSelection) {
          objField[0].formValue = this.Form[key].split(',')
        } else {
          objField[0].formValue = this.Form[key]
        }
      }
    },
    handleEdit(scope) {
      GlogbalObj.handleRowDbclick(scope.row, undefined, undefined)
    },
    handleRowDbclick(row, column, event) {
      this.Dialog.type = 'edit'
      this.Dialog.visible = true
      this.checkStrictly = true

      // 清除表单校验的提示
      if (this.$refs['EditForm']) {
        // 延时执行
        this.$nextTick(function () {
          this.$refs['EditForm'].clearValidate()
        })
      }

      // 克隆一份目标对象
      const fields = deepClone(row)

      // 循环目标对象
      for (const [key, value] of Object.entries(this.Form)) {
        // 直接给form对象赋值，主要用于表单验证及修改提交
        GlogbalObj.Form[key] = fields[key]

        // 找到fileds数组中的目标字段对象
        const objField = this.Fields.filter(function (item) {
          if (item.name === key) {
            return item
          }
        })

        // 如果是多选字段需要将字符串解成数组提供给选择器
        if (objField[0].multiSelection) {
          var strs = [] // 定义一数组
          strs = fields[key].split(',')

          if (objField[0].codeCreate) {
            // 将字符串数组映射为key,label结构作为数据源提供给选择器
            var tagarr = strs.map((item) => {
              return { key: item, label: item }
            })

            // 循环数组，如果目标数据源不存在则加入
            tagarr.forEach((item) => {
              const optionObj = objField[0].codeSource.filter(function (
                option
              ) {
                if (option.key === item.key) {
                  return option
                }
              })

              if (optionObj.length === 0) {
                objField[0].codeSource.push(item)
              }
            })
          }

          // 其他类型的值直接将对象值赋给formValue结构
          objField[0].formValue = strs
        } else {
          objField[0].formValue = fields[key]
        }
      }
    },
    handleDelete({ $index, row }) {
      this.$confirm('是否确认删除？', '操作确认', {
        confirmButtonText: '确认',
        cancelButtonText: '取消',
        type: 'warning',
      })
        .then(async () => {
          this.loading = true
          await deleteCodes(row.sid)
          this.Rows.splice($index, 1)
          ClearCodes(this.Query.parentID)
          this.queryTree('1089764a91421000')
          this.$message({
            type: 'success',
            message: '删除完成！',
          })
          this.loading = false
        })
        .catch((err) => {
          console.error(err)
        })
    },

    handleBatchDelete() {
      this.$confirm(
        '供选择了' +
          this.Table.multipleSelection.length +
          '条数据，是否确认删除？',
        '操作确认',
        {
          confirmButtonText: '确认',
          cancelButtonText: '取消',
          type: 'warning',
        }
      )
        .then(async () => {
          const set = []
          this.Table.multipleSelection.forEach((sel) => {
            set.push(sel.sid)
          })
          await deleteCodes(set)

          set.forEach((key) => {
            this.Rows.splice(indexOf(this.Rows, 'sid', key), 1)
          })

          ClearCodes(this.Query.parentID)
          this.queryTree('1089764a91421000')
          this.getCodeList()
          this.$message({
            type: 'success',
            message: '删除完成！',
          })
        })
        .catch((err) => {
          console.error(err)
        })
    },
    async SubmitForm(down) {
      this.loading = true
      const isEdit = this.Dialog.type === 'edit'
      if (isEdit) {
        await updateCodes(this.Form.sid, this.Form)
        for (let index = 0; index < this.Rows.length; index++) {
          if (this.Rows[index].sid === this.Form.sid) {
            // 如果是修改，提交完成后，更新本地列表缓存中的数据
            this.Rows.splice(index, 1, Object.assign({}, this.Form))
            break
          }
        }
      } else {
        const { data } = await addCodes(this.Form)
        // 如果是新增将新的对象插入到本地列表
        this.Rows.push(data)
      }
      this.queryTree('1089764a91421000')
      this.getCodeList()
      this.loading = false
      down()
      this.Dialog.visible = false
      this.$notify({
        title: '完成',
        dangerouslyUseHTMLString: true,
        message: `
            <div>代码ID: ${this.Form.sid}</div>
            <div>代码名称: ${this.Form.name}</div>
            <div>代码描述: ${this.Form.description}</div>
          `,
        type: 'success',
      })
    },
  },
}
</script>

<style lang="scss">
.el-scrollbar__wrap {
  overflow-x: hidden;
}
.el-select-dropdown__list {
  padding: 0 0 18px;
}
.el-drawer__header {
  margin-bottom: 15px;
}

.el-aside {
  overflow: hidden;
}
aside {
  padding: 0px;
  margin-bottom: 0px;
  margin-right: 3px;
  border-radius: 2px;
  display: block;
  background: #ffffff;
}
.el-main {
  padding: 0px;
}
.el-tree {
  position: relative;
  margin: 2px;
  background: rgba(255, 255, 255, 1);
}

.el-tabs--border-card > .el-tabs__content {
  padding: 2px 0 !important;
}

.el-cascader--mini {
  font-size: 12px;
  line-height: 32px;
  width: 70%;
}
</style>

<style lang="scss" scoped>
.app-container {
  .roles-table {
    margin-top: 10px;
  }

  .permission-tree {
    margin-bottom: 10px;
  }

  padding-top: 10px;
}

.query-container {
  display: block;
}

.query-row {
  display: block;
  margin-top: 7px;
  float: left;
}

.query-title {
  line-height: 32px;
  width: 100px;
  align-content: flex-end;
  text-align: right;
  margin-right: 5px;
  float: left;
}

.query-content {
  line-height: 32px;
}

.action-row {
  display: block;
  clear: both;
  position: relative;
  line-height: 28px;
  padding-top: 10px;
}
</style>
