const axios = require('axios');

async function test() {
  const dummyUserImage = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAGBAQABAAAAAA//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQAAPwAA//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAhAAPwAA//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAxAAPwAA/9k=';
  
  try {
    const res = await axios.post('http://localhost:5001/api/tryon', {
      userImage: dummyUserImage,
      productId: '69ea64820693964d3f24afde' // The ID from user's screenshot
    });
    console.log("Success:", res.data.success);
    if(res.data.data.resultImageUrl.startsWith('images/')) {
        console.log("Returned FALLBACK static image:", res.data.data.resultImageUrl);
    } else {
        console.log("Returned dynamic generated image starting with:", res.data.data.resultImageUrl.substring(0, 30));
    }
  } catch (e) {
    console.error("Failed:", e.message);
    if(e.response) console.error(e.response.data);
  }
}
test();
