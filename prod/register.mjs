// register.mjs
import { register } from 'node:module';

// loader.mjs を登録
register('./loader.mjs', import.meta.url);