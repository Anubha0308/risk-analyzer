import React from "react";
import CardNav from "./navbar";
import Footer from "./footer";
import DecryptedText from "./DecryptedText";

const defaultLogo = "https://flowbite.com/docs/images/logo.svg";

function Home() {
  const items = [
    {
      label: "About",
      bgColor: "#0D0716",
      textColor: "#fff",
      links: [
        { label: "Company", ariaLabel: "About Company" },
        { label: "Careers", ariaLabel: "About Careers" },
      ],
    },
    {
      label: "Projects",
      bgColor: "#170D27",
      textColor: "#fff",
      links: [
        { label: "Featured", ariaLabel: "Featured Projects" },
        { label: "Case Studies", ariaLabel: "Project Case Studies" },
      ],
    },
    {
      label: "Contact",
      bgColor: "#271E37",
      textColor: "#fff",
      links: [
        { label: "Email", ariaLabel: "Email us" },
        { label: "Twitter", ariaLabel: "Twitter" },
        { label: "LinkedIn", ariaLabel: "LinkedIn" },
      ],
    },
  ];
  return (
    <div className="min-h-screen w-screen bg-[#1f1f1f] flex flex-col">
      <header className="w-full flex justify-center pt-4">
        <CardNav
          logo={defaultLogo}
          logoAlt="Logo"
          items={items}
          baseColor="#fff"
          menuColor="#000"
          buttonBgColor="#111"
          buttonTextColor="#fff"
          ease="power3.out"
        />
      </header>

      <section className="flex flex-1 items-center">
        <div className="w-1/2 pl-16 text-6xl font-bold leading-tight">
          <DecryptedText
            text="This text animates when in view"
            animateOn="view"
            revealDirection="center"
          />
        </div>
      </section>

      <Footer />
    </div>
  );
}
export default Home;
