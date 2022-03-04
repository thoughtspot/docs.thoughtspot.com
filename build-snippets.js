// const folder = process.argv.pop()
const folder = '/software/Software'

const path = require('path')
const {readdirSync, readFileSync, writeFileSync, mkdirSync, unlinkSync, existsSync} = require('fs')

const basePath = path.join(__dirname, '') + '/build'
const outputPath = basePath + folder
const outputFolder = 'embed-snippets'

console.log(`folder: ${folder}, basePath: ${basePath}, outputPath: ${outputPath}`)

const docsBaseUrl = 'https://docs.thoughtspot.com/latest'

const embedTemplate = `
<!DOCTYPE html>
<html>
	<head>
		<link rel="stylesheet" href="https://docs.thoughtspot.com/_/css/vendor/snippet.css" />
		<title>$title</title>
	</head>
	<body>
		$html
		<p><a href="$docsUrl" target="_blank">View full documentation.</a></p>
	</body>
</html>
`

const getFilesAndDirectories = (directoryPath, includeFiles = false) => {
	return readdirSync(directoryPath, {withFileTypes: true})
		.filter(file => {
			// Don't do the embed snippets dir
			if (file.name == 'embed-snippets')
				return false

			if (!file.isDirectory() && path.extname(file.name).toLowerCase() !== '.html')
				return false

			// Include files if flag is true, otherwise only include if is directory.
			return includeFiles ? true : file.isDirectory()
		})
		.map(file => {
			if (file.isDirectory()) {
				return {dirname: file.name, filesAndFolders: getFilesAndDirectories(`${directoryPath}/${file.name}`, true)}
			} else {
				return file.name
			}
		})
}

const extractSnippetHtml = (htmlRows, foundTags) => {
	let foundTag = null

	// Walk down the array and find the closing shortcode while accounting for child shortcode pairs.
	function walkForClosingTag(startIndex) {
		let openTagCount = 0
		let found = false
		htmlRows.slice(startIndex).forEach((row, i) => {
			if (found !== false)
				return

			const startTagMatch = row.trim().match(/<p>.*?\[embed.+?label\=\"(.*?)\"\].*?<\/p>/)
			const endTagMatch = row.trim().match(/<p>.*?\[\/embed\].*?<\/p>/)

			if (startTagMatch) {
				openTagCount += 1
			}

			if (endTagMatch) {
				if (openTagCount == 1) {
					found = startIndex + i
				} else {
					openTagCount -= 1
				}
			}
		})

		return found
	}

	htmlRows.forEach((row, i) => {
		if (foundTag)
			return

		const startTagMatch = row.trim().match(/<p>.*?\[embed.+?label\=\"(.*?)\"\].*?<\/p>/)
		if (startTagMatch && startTagMatch[1]) {
			foundTag = {label: startTagMatch[1], startIndex: i}
			const closingTagIndex = walkForClosingTag(i)
			foundTag.endIndex = closingTagIndex
		}
	})

	if (foundTag) {
		// Copy the HTML between the found tags and store it on the tag.
		foundTag.htmlRows = htmlRows.slice(foundTag.startIndex+1, foundTag.endIndex)

		// Remove the already crawled HTML so we don't recrawl it when we recur.
		htmlRows.splice(foundTag.startIndex, (foundTag.endIndex - foundTag.startIndex) + 1)
		foundTags.push(foundTag)

		// Run again to extract nested tags
		extractSnippetHtml(foundTag.htmlRows, foundTags)

		// Run again to find more unnested tags
		return extractSnippetHtml(htmlRows, foundTags)
	} else {
		return foundTags
	}
}

const generateFileSnippets = (path, file) => {
	let sourceHtml = readFileSync(`${basePath}${folder}${path}/${file}`).toString()
	let htmlRows = sourceHtml.split('\n')


	let foundTags = extractSnippetHtml(htmlRows, [])

	const snippetOutputPath = `${outputPath}/${path.split('/')[1]}/${outputFolder}/`

	if (foundTags.length)
		console.log(`generateFileSnippets: ${snippetOutputPath} ${file}`)

	try {
		if (!snippetOutputPath || !existsSync(snippetOutputPath))
			mkdirSync(snippetOutputPath)
	} catch(e) {
		return
	}

	foundTags.forEach((tag) => {
		let outputHtml = tag.htmlRows.join('\n')

		outputHtml = embedTemplate
			.replace('$title', tag.label)
			.replace('$html', outputHtml)
			.replace('$docsUrl', `${docsBaseUrl}${path}/${file}#${tag.label}`)

		const fileNameArray = file.split('.')
		fileNameArray[fileNameArray.length-2] += `]${tag.label}`

		const snippetFileName = '[' + path.split('/').slice(2) + ']' + '[' + fileNameArray.join('.')

		writeFileSync(`${snippetOutputPath}/${snippetFileName}`, outputHtml)
	})
}

const generateSnippets = (filesAndFolders, currentPath) => {
	filesAndFolders.forEach(fileOrFolder => {
		if (fileOrFolder.dirname) {
			const newCurrentPath = `${currentPath}/${fileOrFolder.dirname}`
			generateSnippets(fileOrFolder.filesAndFolders, newCurrentPath)
		} else {
			try {
				generateFileSnippets(currentPath, fileOrFolder)
			} catch (e) {}
		}
	})
}

// const generateTestData = () => {
// 	let filePath = `${basePath}/admin/mobile/use-mobile.html`
// 	let sourceHtml = readFileSync(filePath).toString()
// 	sourceHtml = sourceHtml.replace('<h3 id="for-administrators">For administrators:</h3>', `
// 		<p>[embed label="for-administrators"]</p>
// 		<h3 id="for-administrators">For administrators:</h3>`)
// 	sourceHtml = sourceHtml.replace('<h3 id="for-users">For users:</h3>', `
// 		<p>[/embed]</p>
// 		<h3 id="for-users">For users:</h3>`)
// 	writeFileSync(filePath, sourceHtml)

// 	filePath = `${basePath}/admin/mobile/install-mobile.html`
// 	sourceHtml = readFileSync(filePath).toString()
// 	sourceHtml = sourceHtml.replace('<h2 id="install-the-app">Install the app</h2>', `
// 		<p>[embed label="for-administrators"]</p>
// 		<h2 id="install-the-app">Install the app</h2>`)
// 	sourceHtml = sourceHtml.replace('<h2 id="set-up-the-app">Set up the app</h2>', `
// 		<p>[/embed]</p>
// 		<h2 id="set-up-the-app">Set up the app</h2>`)
// 	writeFileSync(filePath, sourceHtml)
// }

// generateTestData()

// output to build/software/Software/6.2/embed-snippets/[filename].html

const filesAndFoldersToCrawl = getFilesAndDirectories(basePath + folder + '/')

// console.log('filesAndFoldersToCrawl', JSON.stringify(filesAndFoldersToCrawl))

generateSnippets(filesAndFoldersToCrawl, '')
