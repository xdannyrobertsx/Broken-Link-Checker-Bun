import readline from "readline";
import { LinkChecker } from "linkinator";
import { SingleBar, Presets } from "cli-progress";

async function checkLinksFromFile(filename, filterBroken) {
  const outputFilePath = "broken_links.csv";

  const file = Bun.file(filename);

  try {
    if (file.size == 0) {
      console.error(`The file "${filename}" does not exist.`);
      return;
    }

    const fileText = await file.text();
    const links = fileText.split("\n").filter((link) => {
      return lineCleaner(link.trim()) !== "";
    });

    const checker = new LinkChecker();

    const brokenLinks = [];

    checker.on("pagestart", (url) => {
      console.log(`Scanning ${url}`);
    });

    checker.on("link", (result) => {
      if (!filterBroken || (result.state === "BROKEN" && result.status != 0)) {
        brokenLinks.push(result);
      }
    });

    const progressBar = new SingleBar(
      {
        format: "Progress |{bar}| {percentage}% || {value}/{total} Links",
        barCompleteChar: "\u2588",
        barIncompleteChar: "\u2591",
        hideCursor: true,
      },
      Presets.shades_classic
    );

    progressBar.start(links.length, 0);

    for (const link of links) {
      await checker.check({
        path: `${link}`,
        recurse: true,
        timeout: 10000,
      });

      progressBar.increment();
    }

    progressBar.stop();

    const csvContent = brokenLinks
      .map(
        (link) =>
          `${link.url},${link.state === "BROKEN" ? "BROKEN" : "OK"},${
            link.status
          },${link.parent}`
      )
      .join("\n");

    await Bun.write(
      outputFilePath,
      "Link,Status,HTTP Code,Parent\n" + csvContent
    );

    console.log(
      `Detected ${brokenLinks.length} broken links out of ${links.length} total links.`
    );
  } catch (error) {
    console.error("An error occurred:", error);
  }
}

function lineCleaner(inputLink) {
  const regex = /,|\"/;
  if (!lineChecker(inputLink, regex)) {
    return inputLink;
  }
  return inputLink.replace(regex, "");
}

function lineChecker(inputLink, regex) {
  return regex.test(inputLink);
}

const linksFilename = "links.txt"; // Change this to the desired filename

// Prompt the user for filtering broken links
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question(
  "Do you want to filter only broken links? (yes/no) [yes]: ",
  (answer) => {
    const filterBroken =
      answer.trim().toLowerCase() === "yes" || answer.trim() === "";
    rl.close();
    checkLinksFromFile(linksFilename, filterBroken);
  }
);
