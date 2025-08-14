import axios from "axios";
export const handler = async () => {
  console.log("Hello World");
  const res = await axios.get("https://jsonplaceholder.typicode.com/posts/1");
  console.log(res.data);
  return res;
};
