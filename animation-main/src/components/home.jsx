import React from "react";
import CardNav from "./navbar";
import Footer from "./footer";
import DecryptedText from "./DecryptedText";

const defaultLogo = "https://flowbite.com/docs/images/logo.svg";

function Home() {
  const items = [
    {
      label: "About",
      bgColor: "#ffffff",
      textColor: "#3d4453",
      links: [
        { label: "Company", ariaLabel: "About Company" },
        { label: "Careers", ariaLabel: "About Careers" },
      ],
    },
    {
      label: "Projects",
      bgColor: "#f1f4f9",
      textColor: "#3d4453",
      links: [
        { label: "Featured", ariaLabel: "Featured Projects" },
        { label: "Case Studies", ariaLabel: "Project Case Studies" },
      ],
    },
    {
      label: "Contact",
      bgColor: "#e6eef9",
      textColor: "#3d4453",
      links: [
        { label: "Email", ariaLabel: "Email us" },
        { label: "Twitter", ariaLabel: "Twitter" },
        { label: "LinkedIn", ariaLabel: "LinkedIn" },
      ],
    },
  ];
  return (
    <div className="min-h-screen w-screen bg-[#fafbfc] flex flex-col">
      <header className="w-full flex justify-center pt-4">
        <CardNav
          logo={defaultLogo}
          logoAlt="Logo"
          items={items}
          baseColor="#3d4453"
          menuColor="#3d4453"
          buttonBgColor="#309bed"
          buttonTextColor="#fafbfc"
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
