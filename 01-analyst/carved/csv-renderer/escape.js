var // CARVED Ige: VariableDeclarator chars 1514844-1514909
Ige={"&":`&amp;`,"<":`&lt;`,">":`&gt;`,'"':`&quot;`,"'":`&#039;`};
// CARVED Dx: FunctionDeclaration chars 1514910-1514988
function Dx(e){return e?e.replace(/[&<>"']/g,function(e){return Ige[e]}):null}
module.exports={Dx,Ige};
