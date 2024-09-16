"use client";
import { useTheme } from "next-themes";
import router from "next/router";
import React from "react";
import D3WordCloud from "react-d3-cloud";
type Props = {};

const data = [
  {
    text: "선녀와나무꾼",
    value: 3,
  },
  {
    text: "math",
    value: 5,
  },
  {
    text: "english",
    value: 25,
  },
  {
    text: "physics",
    value: 10,
  },
  {
    text: "미분적분",
    value: 10,
  },
  {
    text: "bitcoin",
    value: 10,
  },
  {
    text: "StockMarket",
    value: 10,
  },
];

const fontSizeMapper = (word: { value: number }) =>
  Math.log2(word.value) * 5 + 20;

const CustomWordCloud = (props: Props) => {
  const theme = useTheme();
  return (
    <>
      <D3WordCloud
        data={data}
        height={550}
        font="Times"
        fontSize={fontSizeMapper}
        rotate={0}
        padding={10}
        fill={theme.theme === "dark" ? "white" : "black"}
        onWordClick={(e, d) => {
          router.push("/quiz?topic=" + d.text);
        }}
      />
    </>
  );
};

export default CustomWordCloud;
