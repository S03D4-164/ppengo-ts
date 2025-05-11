import WebpageModel from "../models/webpage";
import WebsiteModel from "../models/website";

interface InputUrl {
  url: string;
  option: any; // Replace `any` with the specific type if known
}

interface User {
  group: string[]; // Assuming `group` is an array of strings
}

const bulkregister = async function (
  inputUrls: InputUrl[],
  track: number,
  user: User
) {
  console.log(inputUrls);
  const webpages: any = [];
  const websites: any = [];

  for (const input of inputUrls) {
    const inputUrl = input.url;
    const option = input.option;

    const webpage = new WebpageModel({
      input: inputUrl,
      option: option,
    });
    await webpage.save(); // Assuming `save` is required for Webpage instances
    webpages.push(webpage);

    let website = await WebsiteModel.findOne({ url: inputUrl });
    if (website) {
      website.last = webpage._id;
    } else {
      website = new WebsiteModel({
        url: inputUrl,
        last: webpage._id,
      });
    }

    console.log(website.group);
    for (const group of user.group) {
      if (!website.group.includes(group)) {
        website.group.push(group);
      }
    }

    if (track > 0) {
      if (track === 2) {
        website.track = {
          counter: 24,
          period: 1,
          option: option,
        };
      } else if (track === 1) {
        if (!website.track?.counter) {
          website.track = {
            counter: 24,
            period: 1,
            option: option,
          };
        }
      }
    }

    websites.push(website);
  }

  const savedPages = await WebpageModel.bulkSave(webpages);
  const savedSites = await WebsiteModel.bulkSave(websites);

  return webpages;
};

export default bulkregister;
