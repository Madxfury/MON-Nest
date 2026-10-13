// Local signing helper. No keys, wallet passwords, or seed phrases are read.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const artifact = require('../artifacts/contracts/MonNestBookings.sol/MonNestBookings.json');
const { JsonRpcProvider, Contract } = require('ethers');
const signer = '0x2733Bd3F25B762Afc860a4B34aC38E5B5D932563';
const broker = '0xc0aB4B8462792E0BeCE8D5e7d6e31CF4716c08CB';
const origin = 'http://localhost:3011';
let result = null;
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MON-Nest · Deploy booking ledger</title><style>body{margin:0;background:#f5f2eb;color:#181611;font:16px system-ui}main{max-width:620px;margin:8vh auto;padding:32px;background:white;border:1px solid #ded8cb;border-radius:24px}h1{font:42px Georgia}button{padding:16px 24px;border:0;border-radius:40px;background:#181611;color:white;cursor:pointer;font:inherit}button:disabled{opacity:.5}code,pre{overflow-wrap:anywhere;white-space:pre-wrap}p{line-height:1.7}small{color:#635d54}a{color:#6855dc}</style></head><body><main><small>MON—NEST · MONAD TESTNET</small><h1>Publish the booking ledger.</h1><p>One transaction enables all 48 homes at 0 MON for 30-day bookings.</p><p>Deployer<br><code>${signer}</code></p><p>Broker destination<br><code>${broker}</code></p><p>Amount sent: <strong>0 MON</strong>. Deployment gas is paid by your wallet.</p><button id="deploy">Connect MetaMask & deploy</button><p id="status" role="status"></p><pre id="result"></pre><p id="link"></p><small>Review the deployment in MetaMask. This local helper never requests a private key.</small></main><script src="/ethers.js"></script><script>
const button=document.getElementById('deploy'),status=document.getElementById('status');
button.onclick=async()=>{button.disabled=true;try{
 if(!window.ethereum)throw Error('Open this local page in Chrome with MetaMask enabled.');
 const provider=new ethers.BrowserProvider(window.ethereum);await provider.send('eth_requestAccounts',[]);
 const account=await provider.getSigner();if((await account.getAddress()).toLowerCase()!=='${signer.toLowerCase()}')throw Error('Select the deployer wallet shown above in MetaMask.');
 try{await provider.send('wallet_switchEthereumChain',[{chainId:'0x279f'}]);}catch(e){if(e.code!==4902)throw e;await provider.send('wallet_addEthereumChain',[{chainId:'0x279f',chainName:'Monad Testnet',nativeCurrency:{name:'MON',symbol:'MON',decimals:18},rpcUrls:['https://testnet-rpc.monad.xyz'],blockExplorerUrls:['https://testnet.monadvision.com']}]);await provider.send('wallet_switchEthereumChain',[{chainId:'0x279f'}]);}
 const fresh=new ethers.BrowserProvider(window.ethereum);if((await fresh.getNetwork()).chainId!==10143n)throw Error('Select Monad Testnet.');
 const signer=await fresh.getSigner();if((await signer.getAddress()).toLowerCase()!=='${signer.toLowerCase()}')throw Error('The selected wallet changed.');
 const artifact=await(await fetch('/artifact')).json();status.textContent='Review and approve the deployment in MetaMask…';
 const contract=await new ethers.ContractFactory(artifact.abi,artifact.bytecode,signer).deploy(await signer.getAddress(),'${broker}');
 const hash=contract.deploymentTransaction().hash;localStorage.setItem('mon-nest-deployment-tx',hash);status.textContent='Submitted '+hash+'. Waiting for confirmation…';
 const receipt=await contract.deploymentTransaction().wait();if(receipt.status!==1)throw Error('Deployment failed.');
 const response=await fetch('/result',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({hash})});const result=await response.json();if(!response.ok)throw Error(result.error);
 document.getElementById('result').textContent='NEXT_PUBLIC_MON_NEST_BOOKINGS_ADDRESS='+result.address+'\\nNEXT_PUBLIC_MON_NEST_BOOKINGS_DEPLOY_BLOCK='+result.block;
 const link=document.createElement('a');link.href='https://testnet.monadvision.com/tx/'+hash;link.target='_blank';link.textContent='View deployment receipt ↗';document.getElementById('link').replaceChildren(link);status.textContent='Contract deployed and all 48 homes verified. Return to Codex to connect the app.';
}catch(e){status.textContent=e.shortMessage||e.message;button.disabled=false;}};
</script></body></html>`;
http.createServer(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (!['localhost:3011', '127.0.0.1:3011'].includes(req.headers.host)) { res.writeHead(403); return res.end(); }
  if (req.method === 'GET' && req.url === '/') { res.setHeader('Content-Type','text/html'); return res.end(html); }
  if (req.method === 'GET' && req.url === '/ethers.js') { res.setHeader('Content-Type','text/javascript'); return fs.createReadStream(path.join(path.dirname(require.resolve('ethers')), '../dist/ethers.umd.min.js')).pipe(res); }
  if (req.method === 'GET' && req.url === '/artifact') { res.setHeader('Content-Type','application/json'); return res.end(JSON.stringify({ abi: artifact.abi, bytecode: artifact.bytecode })); }
  if (req.method === 'GET' && req.url === '/result') { res.setHeader('Content-Type','application/json'); return res.end(JSON.stringify(result)); }
  if (req.method === 'POST' && req.url === '/result' && req.headers.origin === origin) {
    try {
      let body=''; for await (const chunk of req) { body+=chunk; if(body.length>1000)throw Error('Invalid request'); }
      const {hash}=JSON.parse(body);if(!/^0x[\da-f]{64}$/i.test(hash))throw Error('Invalid transaction hash');
      const rpc=new JsonRpcProvider('https://testnet-rpc.monad.xyz',10143);
      const receipt=await rpc.getTransactionReceipt(hash);const tx=await rpc.getTransaction(hash);
      if(!receipt || receipt.status!==1 || !receipt.contractAddress || tx?.from.toLowerCase()!==signer.toLowerCase() || tx.to!==null)throw Error('Deployment receipt not valid');
      const contract=new Contract(receipt.contractAddress,artifact.abi,rpc);
      if((await contract.owner()).toLowerCase()!==signer.toLowerCase() || (await contract.broker()).toLowerCase()!==broker.toLowerCase())throw Error('Contract roles do not match');
      const ids=Array.from({length:48},(_,index)=>index+1);const [listings,,rented]=await contract.getBookingSnapshots(ids);if(listings.length!==48||listings.some(listing=>listing.priceWei!==0n||listing.durationSeconds!==2592000n||!listing.active)||rented.some(Boolean))throw Error('Listing configuration mismatch');
      result={address:receipt.contractAddress,block:receipt.blockNumber,hash,broker};
      console.log('VERIFIED_DEPLOYMENT '+JSON.stringify(result));
      res.setHeader('Content-Type','application/json');return res.end(JSON.stringify(result));
    } catch(e) {res.writeHead(400,{'Content-Type':'application/json'});return res.end(JSON.stringify({error:e.message}));}
  }
  res.writeHead(404);res.end();
}).listen(3011,'127.0.0.1',()=>console.log('Open http://localhost:3011 in the Chrome profile containing MetaMask.'));
