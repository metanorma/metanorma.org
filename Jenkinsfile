node("${env.NODE}") {
  currentBuild.result = "SUCCESS"

  try {
    stage('Clean up') {
      deleteDir()
    }

    stage('Checkout') {
      checkout scm
    }

    stage('D/L dependencies') {
      sh 'gem install bundler'
      sh 'bundle'
    }

    stage('Test') {
      sh 'rake test:production'
    }

    stage('Build production') {
      sh 'rake build:production'
    }

    stage('Deploy') {
      def files = findFiles(glob: '_site/**/*')
      files.each { 
          def file = it
          def dst = file.path.replace('_site/', '')
          println "file:  ${file}"
          println "name:  ${file.name}"
          println "path:  ${file.path}"
          println "dst:  ${dst}"

          withAWS(region:"${env.REGION}",credentials:"${env.CREDENTIAL}") {
            s3Upload(
              bucket: "${env.HOST}",
              file: "${file.path}",
              path: "${dst}", 
            )
          }
      }
    }

    stage('Invalidate Cloudfront') {
      withAWS(region:"${env.REGION}",credentials:"${env.CREDENTIAL}") {
        cfInvalidate(distribution: "${env.CF_DIST_ID}", paths: ['/*'])
      }
    }
  } catch (err) {
    currentBuild.result = 'FAILURE'
    throw err
  }
}
