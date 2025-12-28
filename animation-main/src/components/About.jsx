import React from "react";
import Header from "./Header.jsx";

function About() {
  const teamMembers = [
    {
      name: "Tavishi Sharma",
      github: "taviishii",
      githubUrl: "https://github.com/taviishii",
    },
    {
      name: "Anubha Sharma",
      github: "Anubha_0308",
      githubUrl: "https://github.com/Anubha_0308",
    },
  ];

  return (
    <div
      className="bg-[#f6f7f8] dark:bg-[#0d171b] text-[#0d171b] dark:text-white min-h-screen flex flex-col"
      style={{ fontFamily: "Manrope, sans-serif" }}
    >
      <Header />

      <main className="flex-grow">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12">
          
          {/* Header Section */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4">
              About RiskAI
            </h1>
            <p className="text-lg text-[#4c809a] dark:text-slate-400 max-w-2xl mx-auto">
              AI-powered stock risk analysis platform designed to help investors
              make informed decisions and protect their portfolios.
            </p>
          </div>

          {/* Team Section */}
          <div className="bg-white dark:bg-slate-800/50 rounded-2xl p-8 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700">
            <h2 className="text-2xl font-bold mb-6 text-center">
              Our Team
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {teamMembers.map((member, index) => (
                <div
                  key={index}
                  className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-6 ring-1 ring-slate-200 dark:ring-slate-700 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#13a4ec]/10 text-[#13a4ec] ring-2 ring-[#13a4ec]/20">
                      <span className="material-symbols-outlined text-3xl">
                        person
                      </span>
                    </div>

                    <div className="flex-1">
                      <h3 className="text-xl font-bold mb-1">
                        {member.name}
                      </h3>
                      <a
                        href={member.githubUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#13a4ec] hover:text-[#0f8ac4] text-sm font-semibold flex items-center gap-1 transition-colors"
                      >
                        <span className="material-symbols-outlined text-base">
                          code
                        </span>
                        {member.github}
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Mission Section */}
          <div className="mt-8 bg-white dark:bg-slate-800/50 rounded-2xl p-8 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700">
            <h2 className="text-2xl font-bold mb-4">
              Our Mission
            </h2>
            <p className="text-[#4c809a] dark:text-slate-300 leading-relaxed">
              RiskAI leverages advanced machine learning algorithms to analyze
              stock market data and provide real-time risk assessments. Our
              platform helps investors identify potential downside risks before
              they materialize, enabling better portfolio protection and
              informed decision-making.
            </p>
          </div>

        </div>
      </main>
    </div>
  );
}

export default About;
