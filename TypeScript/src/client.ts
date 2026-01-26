// 依赖的模块可通过下载工程中的模块依赖文件或右上角的获取 SDK 依赖信息查看
import ocr_api20210707, * as $ocr_api20210707 from '@alicloud/ocr-api20210707';
import OpenApi, * as $OpenApi from '@alicloud/openapi-client';
import Util, * as $Util from '@alicloud/tea-util';
import Stream from '@alicloud/darabonba-stream';
import Credential from '@alicloud/credentials';
import { Readable } from 'stream';
import * as $tea from '@alicloud/tea-typescript';


export default class Client {

  /**
   * @remarks
   * 使用凭据初始化账号Client
   * @returns Client
   * 
   * @throws Exception
   */
  static createClient(): ocr_api20210707 {
    // 工程代码建议使用更安全的无AK方式，凭据配置方式请参见：https://help.aliyun.com/document_detail/378664.html。
    let credential = new Credential();
    let config = new $OpenApi.Config({
      credential: credential,
    });
    // Endpoint 请参考 https://api.aliyun.com/product/ocr-api
    config.endpoint = `ocr-api.cn-hangzhou.aliyuncs.com`;
    return new ocr_api20210707(config);
  }

  static async main(args: string[]): Promise<void> {
    let client = Client.createClient();
    // 需要安装额外的依赖库，直接点击下载完整工程即可看到所有依赖。
    let bodyStream = Stream.readFromFilePath("<your-file-path>");
    let recognizeAdvancedRequest = new $ocr_api20210707.RecognizeAdvancedRequest({
      body: bodyStream,
      outputCharInfo: false,
      needRotate: false,
      outputTable: false,
      needSortPage: false,
      outputFigure: false,
      noStamp: false,
      paragraph: false,
      row: false,
    });
    let runtime = new $Util.RuntimeOptions({ });
    try {
      let resp = await client.recognizeAdvancedWithOptions(recognizeAdvancedRequest, runtime);
      console.log(JSON.stringify(resp, null, 2));
    } catch (error) {
      // 此处仅做打印展示，请谨慎对待异常处理，在工程项目中切勿直接忽略异常。
      // 错误 message
      console.log(error.message);
      // 诊断地址
      console.log(error.data["Recommend"]);
    }    
  }

}

Client.main(process.argv.slice(2));