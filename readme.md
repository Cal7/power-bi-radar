# Setting up a dev environment
1. Clone the repository; `git clone https://github.com/Cal7/power-bi-radar`
2. `cd` into the directory
3. Install its Node packages; `npm install`
4. Start the visual's server; `pbiviz start`. If an "Invalid API version" occurs, run `pbiviz update`

Note: if this is the first custom visual to be running on the machine then there are a few extra steps to be performed first; namely, `npm install -g powerbi-visuals-tools` will install the tool used to start and stop the visual's server (amongst other things). This server only allows communication over HTTPS, so the steps [here](https://github.com/Microsoft/PowerBI-visuals/blob/master/tools/CertificateAddWindows.md) must also be followed (this does not need to be repeated for other visuals).

Custom visuals in development can only be viewed via [Power BI Service](https://app.powerbi.com), Power BI's web app. "Enable developer visual for testing" must first be checked within Settings>General. Once this is done an extra icon will appear in the Visualizations window.

# Using the visual in Power BI Desktop
When a visual is ready, it may be packaged for use in Power BI Desktop. Run `pbiviz package`, which produces a `radar.pbiviz` file within the `dist` directory. From here, one can import the visual into PBI Desktop by clicking on the three dots in the Visualizations pane, and choosing "Import from file". It can now be used in the report like any standard visual.

# External libraries
The visual uses three external JavaScript libraries; [d3](https://d3js.org/) to ease DOM manipulation, [lodash](https://lodash.com/) to provide common utilities like removing duplicates from an array, and [TinyColor](https://github.com/bgrins/TinyColor) for common colour manipulations (such as converting hex codes to HSL, darkening a colour, etc.)

External libraries get defined in tsconfig.json by adding their file locations to the "files" array. It is recommended to also add the relevant typings files.

# The radar "hierarchy"
There are four main classes involved in representing a radar as a whole. The overall class is a Radar. This has a property called sectors, which is an array of Sector instances. In each Sector instance is an array of Blip instances. Each Blip then has a Ring.

# Sharing the visual
A report containing the visual may be shared by going to File>Publish to web.

A common mistake when doing this is to still be using the "Developer visual", running from the local machine's server, rather than a packaged form of the visual. When this happens, users viewing the report will see an error about developer visuals not being enabled in their settings.

Instead, the visual should be packaged, embedded in a report in Power BI Desktop, and then the report uploaded to Power BI Service, where all users will be able to view it.