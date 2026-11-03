// stand-ins: DC (dateformat), MC (markdown table), _N (xlsx)
const {Ire}=require("./tabulatorCsvDownloader.js");
const ResultTable={
// CARVED download: ObjectMethod chars 4061996-4062746
download(e){let t=e,n=(0,DC.default)(new Date,`yyyy-mm-dd_hMMss`),r=this.query.title?U.default.snakeCase(this.query.title):`query_results`;e===`md`&&(t=(e,t,n)=>{n(MC(e.map(e=>e.columns.map(e=>typeof e.value==`object`?JSON.stringify(e.value):e.value))),`text/markdown`)}),e===`json`&&(t=(e,t,n)=>{n(JSON.stringify(this.dataToJson(this.tabulator.getData(),!1),null,`  `),`text/json`)}),e===`xlsx`&&(t=(e,t,n)=>{let i=e.map(e=>e.columns.map(e=>e.value===null?``:typeof e.value==`object`?JSON.stringify(e.value):e.value)),a=_N.utils.aoa_to_sheet(i),o=_N.utils.book_new(),s=r.slice(0,31);r.toLowerCase()===`history`&&(s=`history-sheet`),_N.utils.book_append_sheet(o,a,s),n(_N.write(o,{type:`buffer`}))}),this.tabulator.download(t,`${r}-${n}.${e}`,`all`)}
};
module.exports={ResultTable};
