import {mkdirSync,existsSync,statSync,createWriteStream,renameSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname} from 'node:path';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
const files=['config.json','generation_config.json','tokenizer.json','tokenizer_config.json','special_tokens_map.json','onnx/encoder_model_quantized.onnx','onnx/decoder_model_merged_quantized.onnx','README.md'];
const model=process.argv[2] || 'opus-mt-mul-en';
if(!/^opus-mt-[a-z]+-en$/.test(model))throw new Error('Invalid model name');
for(let i=0;i<files.length;i+=3)await Promise.all(files.slice(i,i+3).map(async file=>{
  const path=fileURLToPath(new URL(`../assets/translation/${model}/${file}`,import.meta.url));
  if(existsSync(path) && statSync(path).size>100)return;
  mkdirSync(dirname(path),{recursive:true});
  const response=await fetch(`https://huggingface.co/Xenova/${model}/resolve/main/${file}`);
  if(!response.ok)throw new Error(`Model download failed: ${file} (${response.status})`);
  await pipeline(Readable.fromWeb(response.body),createWriteStream(`${path}.part`));renameSync(`${path}.part`,path);console.log(`Downloaded ${file}`);
}));
console.log('Local translation model ready');
