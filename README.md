# 360mash

_360mash_ is a simple desktop tool to post-process and render 2D, 180 and 360 video.
The aim is to develop a free, cross-platform, lightweight tool for clipping, reframing and anonymising video files and exporting the resulting video as fast as possible.
At present, the tool can accomplish a range of transformations of a video file, such as:
- Import a 2D, 180 or 360 video and export a clip, ie. a trimmed, shorter version.
- Import a 180 or 360 video and export a clip that retains the original equirectangular format.
- Import a 180 or 360 video and export a reframing of the video as a 2D video.
- Import a video and apply basic filters to anonymise the video.
- Import a 2D, 180 or 360 video and export at a different resolution.
- Zoom in and pan a 180 or 360 video to find the best view in the scene for export.
- Zoom in and pan a 2D video to find the best view for export.
- Real-time playback of the video with transforms and filters applied.
- Export the desired result to a standard H.264 video file using the CPU or GPU (faster).

## Help

There is a basic [help guide](https://bigsoftvideo.github.io/360mash-guide/) that documents how to install, setup and use the software on Windows 10/11 and macOS.

## History

The _360mash_ software package was initially developed as a prototype in 2021 by Artur Kovacs (@ArturKovacs) and Jonas Noermark (@jnoerm19) according to the design specifications of Paul McIlvenny (@skandilocks) and Jacob Davidsen (@codeslayer84) in the [BigSoftVideo](https://github.com/bigsoftvideo) team at Aalborg University, Denmark.

As far as we know, there is still no commercial or free software tool that does all that _360mash_ can do in one neat package.
Therefore, we decided in 2024 to release both a build of the beta version and the codebase for open source development.

Modifications, mainly to the UI, were made in late 2024 by Alexander Stein (@LiminalSpaces) to prepare the code for open-source release.

Given that the package is a beta release, and the UI leaves a lot to be desired, much improvement is possible:
- New and improved filter shaders.
- Filter pipeline presets, eg. with user-defined filter settings plus selection and ordering defaults.
- Create (multiple) Filter zones for each filter.
- UI enhancement, eg. better handling of IN/OUT points and playhead overlap.
- Separate the `Convert 360 to 2D` transform from the reframing operation, eg. add a new transform in the pipeline for just reframing 2D and 360.
- Updating `Video ToolBox` GPU encoder for contemporary macOS (eg. AMD Silicon).
- Options for H.265 encoding.
- Tackling export pipeline bottlenecks.
- Keeping packages updated, eg. Electron, Webpack, Node, Yarn.
- Streamlining build creation and notarisation (eg. Apple).
- Fix bugs.

## Contributing

Please clone or fork the repo and contribute on GitHub.
We welcome pull requests on the `development` branch or branches off development.
We particularly welcome contributions that build new and better shaders for anonymisation.

## Building from source

It is important to initialise all submodules when cloning.
This can be done, for example, with the command:

```
git clone --recurse-submodules https://github.com/Big-Video/360mash.git
```

## Notes

The original code was built with `Node v20.9.0`, `Electron v19`, `Webpack v5` and `Yarn v3.1.1`.
