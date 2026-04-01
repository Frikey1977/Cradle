import pptxgen from "pptxgenjs";
import path from "path";
import os from "os";

// 创建演示文稿
let pres = new pptxgen();
pres.layout = 'LAYOUT_16x9';
pres.author = 'Cradle';
pres.title = 'Hello World';

// 添加一页幻灯片
let slide = pres.addSlide();

// 添加 "Hello World！！！" 文本，居中显示
slide.addText("Hello World！！！", {
  x: 0.5,
  y: 2,
  w: 9,
  h: 2,
  fontSize: 48,
  fontFace: "Arial",
  color: "363636",
  bold: true,
  align: "center",
  valign: "middle"
});

// 保存到用户文档目录
const documentsPath = path.join(os.homedir(), "Documents");
const outputPath = path.join(documentsPath, "hello_world.pptx");

pres.writeFile({ fileName: outputPath })
  .then(() => {
    console.log(`PPT 文件已成功创建: ${outputPath}`);
  })
  .catch(err => {
    console.error("创建 PPT 文件时出错:", err);
  });