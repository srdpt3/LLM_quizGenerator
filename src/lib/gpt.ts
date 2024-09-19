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
  model: string = "gpt-4-turbo", // Use a better model
  temperature: number = 1,
  num_tries: number = 3,
  verbose: boolean = false
): Promise<any> {
  const list_input: boolean = Array.isArray(user_prompt);
  const dynamic_elements: boolean = /<.*?>/.test(JSON.stringify(output_format));
  const list_output: boolean = /\[.*?\]/.test(JSON.stringify(output_format));

  let error_msg: string = "";
  let results: any[] = [];

  for (let prompt of list_input ? user_prompt : [user_prompt]) {
    for (let i = 0; i < num_tries; i++) {
      let output_format_prompt: string = `\nYou are to output the following in json format: ${JSON.stringify(
        output_format
      )}. \nDo not put quotation marks or escape character \\ in the output fields.`;

      if (list_output) {
        output_format_prompt += `\nIf output field is a list, classify output into the best element of the list.`;
      }

      if (dynamic_elements) {
        output_format_prompt += `\nAny text enclosed by < and > indicates you must generate content to replace it. Example input: Go to <location>, Example output: Go to the garden\nAny output key containing < and > indicates you must generate the key name to replace it. Example input: {'<location>': 'description of location'}, Example output: {school: a place for education}`;
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
            { role: "user", content: prompt },
          ],
        });

        let res: string =
          response.choices[0].message?.content?.replace(/'/g, '"') ?? "";
        res = res.replace(/(\w)"(\w)/g, "$1'$2");

        if (verbose) {
          console.log(
            "System prompt:",
            system_prompt + output_format_prompt + error_msg
          );
          console.log("\nUser prompt:", prompt);
          console.log("\nGPT response:", res);
        }

        // Attempt to extract JSON from the response
        const jsonMatch = res.match(
          /\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\}/g
        );
        if (!jsonMatch) {
          throw new Error("No valid JSON found in the response");
        }

        let output: any;
        for (const jsonStr of jsonMatch) {
          try {
            output = JSON.parse(jsonStr);
            break; // If parsing succeeds, break the loop
          } catch (e) {
            console.log("Failed to parse JSON:", jsonStr);
            // Continue to the next match if this one fails
          }
        }

        if (!output) {
          throw new Error("Failed to parse any JSON from the response");
        }

        if (output_value_only) {
          output = Object.values(output);
          if (output.length === 1) {
            output = output[0];
          }
        }

        results.push(output);
        break; // Successfully processed this prompt, move to the next
      } catch (e) {
        error_msg = `\n\nError: ${e}\nInvalid json format. Please try again.`;
        console.log("An exception occurred:", e);
        if (i === num_tries - 1) {
          throw e; // Throw the error on the last try
        }
      }
    }
  }

  return results;
}
