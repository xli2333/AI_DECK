# 全文识别高精版完整工程示例

该项目为RecognizeAdvanced的完整工程示例。

**工程代码建议使用更安全的无AK方式，凭据配置方式请参阅：[管理访问凭据](https://help.aliyun.com/zh/sdk/developer-reference/v2-manage-node-js-access-credentials)。**

## 运行条件

- 下载并解压需要语言的代码;

- *Node.js >= 8.x*

## 执行步骤

完成凭据配置后，可以在**解压代码所在目录下**按如下的步骤执行：

- *安装依赖*
  ```sh
  npm install --registry=https://registry.npmmirror.com
  ```

- *编译并运行*
  ```sh
  tsc && node ./dist/client.js
  ```

## 使用的 API

-  RecognizeAdvanced：支持多格式版面、复杂文档背景和光照环境的精准识别，可实现印章擦除后识别，支持低置信度过滤、图案检测等高阶功能。 更多信息可参考：[文档](https://next.api.aliyun.com/document/ocr-api/2021-07-07/RecognizeAdvanced)

## API 返回示例

*下列输出值仅作为参考，实际输出结构可能稍有不同，以实际调用为准。*


- JSON 格式 
```js
{
  "RequestId": "43A29C77-405E-4CC0-BC55-EE694AD00655",
  "Data": "{ \t\"content\": \"2017年河北区实验小学\", \t\"height\": 3509, \t\"orgHeight\": 3509, \t\"orgWidth\": 2512, \t\"prism_version\": \"1.0.9\", \t\"prism_wnum\": 126, \t\"prism_wordsInfo\": [{ \t\t\"angle\": -89, \t\t\"direction\": 0, \t\t\"height\": 541, \t\t\"pos\": [{ \t\t\t\"x\": 982, \t\t\t\"y\": 223 \t\t}, { \t\t\t\"x\": 1522, \t\t\t\"y\": 223 \t\t}, { \t\t\t\"x\": 1522, \t\t\t\"y\": 266 \t\t}, { \t\t\t\"x\": 982, \t\t\t\"y\": 266 \t\t}], \t\t\"prob\": 99, \t\t\"width\": 43, \t\t\"word\": \"2017年河北区实验小学\", \t\t\"x\": 1230, \t\t\"y\": -26 \t}], \t\"width\": 2512 }",
  "Code": "noPermission",
  "Message": "You are not authorized to perform this operation."
}
```

