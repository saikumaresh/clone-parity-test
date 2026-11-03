const {Ire}=require("./tabulatorCsvDownloader.js");
const ExportModule={
// CARVED processColumnGroup: ClassMethod chars 578443-578824
processColumnGroup(e){var t=e.columns,n=0,r={title:e.definition[`title`+this.colVisPropAttach]||e.definition.title,column:e,depth:1};if(t.length){if(r.subGroups=[],r.width=0,t.forEach(e=>{var t=this.processColumnGroup(e);t&&(r.width+=t.width,r.subGroups.push(t),t.depth>n&&(n=t.depth))}),r.depth+=n,!r.width)return!1}else if(this.columnVisCheck(e))r.width=1;else return!1;return r},
// CARVED columnVisCheck: ClassMethod chars 578824-579031
columnVisCheck(e){var t=e.definition[this.colVisProp];return this.config.rowHeaders===!1&&e.isRowHeader?!1:(typeof t==`function`&&(t=t.call(this.table,e.getComponent())),t===!1||t===!0?t:e.visible&&e.field)},
// CARVED transformRow: ClassMethod chars 464643-465076
transformRow(e,t){var n=`accessor`+(t.charAt(0).toUpperCase()+t.slice(1)),r=e.getComponent(),i=dh.deepClone(e.data||{});return this.table.columnManager.traverse(function(e){var a,o,s,c;e.modules.accessor&&(o=e.modules.accessor[n]||e.modules.accessor.accessor||!1,o&&(a=e.getFieldValue(i),a!=`undefined`&&(c=e.getComponent(),s=typeof o.params==`function`?o.params(a,i,t,c,r):o.params,e.setFieldValue(i,o.accessor(a,i,t,s,c,r)))))}),i},
// CARVED downloadModuleDownload: ClassMethod chars 529279-529607
download(t,n,r,i,a){var o=!1;function s(e,r){a?a===!0?this.triggerDownload(e,r,t,n,!0):a(e):this.triggerDownload(e,r,t,n)}if(typeof t==`function`?o=t:e.downloaders[t]?o=e.downloaders[t]:console.warn(`Download Error - No such download type found: `,t),o){var c=this.generateExportList(i);o.call(this.table,c,r||{},s.bind(this))}}
};
module.exports={ExportModule};
