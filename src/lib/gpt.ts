import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface OutputFormat {
  [key: string]: string | string[] | OutputFormat;
}

export async function strict_output(
  system_prompt: string,
  user_prompt: string | string[],
  output_format: OutputFormat,
  default_category: string = "",
  output_value_only: boolean = false,
  model: string = "gpt-4-turbo",
  temperature: number = 1,
  num_tries: number = 3,
  verbose: boolean = false
): Promise<any> {
  const list_input: boolean = Array.isArray(user_prompt);
  const dynamic_elements: boolean = /<.*?>/.test(JSON.stringify(output_format));
  const list_output: boolean = /\[.*?\]/.test(JSON.stringify(output_format));

  let error_msg: string = "";

  for (let i = 0; i < num_tries; i++) {
    let output_format_prompt: string = `\nYou are to output the following in JSON format: ${JSON.stringify(
      output_format
    )}. Ensure proper formatting of all JSON elements.`;

    if (list_output) {
      output_format_prompt += `\nIf the output field is a list, classify the output into the best element of the list.`;
    }

    if (dynamic_elements) {
      output_format_prompt += `\nEnsure any text enclosed by < and > is replaced with valid content. Example input: Go to <location>, Example output: Go to the garden.`;
    }

    if (list_input) {
      output_format_prompt += `\nGenerate a list of JSON objects, one JSON object for each input element.`;
    }

    try {
      const response = await openai.chat.completions.create({
        temperature: temperature,
        model: model,
        messages: [
          {
            role: "system",
            content: system_prompt + output_format_prompt + error_msg,
          },
          { role: "user", content: user_prompt.toString() },
        ],
      });

      // Clean up the response: replace problematic unescaped quotes
      let res: string = response.choices[0].message?.content ?? "";

      // Handle improperly escaped quotes in values
      res = res
        .replace(/([^\\])"/g, '$1\\"') // Escape double quotes inside values
        .replace(/\\"/g, '"'); // Remove extra escapes on already valid quotes
      res = res.replace(/\\\\"/g, '"'); // Ensure doubly escaped quotes are fixed

      if (verbose) {
        console.log("GPT response after cleanup:", res);
      }

      // Extract multiple JSON objects from the response (handling multiple questions)
      const jsonMatches = res.match(
        /\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\}/g
      );

      if (!jsonMatches || jsonMatches.length === 0) {
        throw new Error("No valid JSON found in the response");
      }

      let outputArray: any[] = [];
      for (const jsonStr of jsonMatches) {
        try {
          const parsedObj = JSON.parse(jsonStr);
          outputArray.push(parsedObj); // Add each parsed JSON object to the output array
        } catch (e) {
          console.log("Failed to parse JSON:", jsonStr);
        }
      }

      if (outputArray.length === 0) {
        throw new Error("Failed to parse any JSON from the response");
      }

      outputArray = list_input ? outputArray : [outputArray];

      // Process each output object
      for (let index = 0; index < outputArray.length; index++) {
        const item = outputArray[index];
        for (const key in output_format) {
          if (/<.*?>/.test(key)) continue;

          if (!(key in item)) {
            throw new Error(`${key} not in JSON output`);
          }

          if (Array.isArray(output_format[key])) {
            const choices = output_format[key] as string[];
            if (Array.isArray(item[key])) {
              item[key] = item[key][0];
            }
            if (!choices.includes(item[key]) && default_category) {
              item[key] = default_category;
            }
            if (typeof item[key] === "string" && item[key].includes(":")) {
              item[key] = item[key].split(":")[0];
            }
          }
        }

        if (output_value_only) {
          outputArray[index] = Object.values(item);
          if (outputArray[index].length === 1) {
            outputArray[index] = outputArray[index][0];
          }
        }
      }

      return list_input ? outputArray : outputArray[0];
    } catch (e) {
      error_msg = `\n\nError: ${e}\nInvalid JSON format. Please try again.`;
      console.log("An exception occurred:", e);
      if (i === num_tries - 1) {
        throw e; // Throw the error on the last try
      }
    }
  }

  throw new Error("Failed to generate valid output after multiple attempts");
}
