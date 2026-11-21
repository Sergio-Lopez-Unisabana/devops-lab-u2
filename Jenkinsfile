pipeline {
    agent any

    environment {
        // Credencial de Jenkins (tipo "Username with password") con el usuario y token de Docker Hub.
        DOCKERHUB_CREDENTIALS = 'dockerhub-credentials'
        DOCKERHUB_USER         = 'TU_USUARIO_DOCKERHUB'
        IMAGE_NAME             = 'ci-cd-lab'
        IMAGE_TAG              = "${env.BUILD_NUMBER}"
        IMAGE_FULL             = "${DOCKERHUB_USER}/${IMAGE_NAME}:${IMAGE_TAG}"
        IMAGE_LATEST           = "${DOCKERHUB_USER}/${IMAGE_NAME}:latest"
    }

    options {
        timestamps()
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '10'))
    }

    stages {
        stage('Checkout Source') {
            steps {
                echo "=== [1/3] Obteniendo código fuente (rama ${env.BRANCH_NAME ?: 'main'}) ==="
                checkout scm
                sh 'git rev-parse --short HEAD'
            }
        }

        stage('Build Docker Image') {
            steps {
                echo "=== [2/3] Construyendo imagen ${env.IMAGE_FULL} ==="
                sh """
                    docker build \
                        --label "org.opencontainers.image.revision=${env.GIT_COMMIT}" \
                        --label "org.opencontainers.image.created=\$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
                        -t "${env.IMAGE_FULL}" \
                        -t "${env.IMAGE_LATEST}" \
                        .
                """
                sh "docker image inspect ${env.IMAGE_FULL} --format '{{.Id}} {{.Size}} bytes'"
            }
        }

        stage('Push to Registry') {
            steps {
                echo "=== [3/3] Publicando imagen en Docker Hub ==="
                withCredentials([usernamePassword(
                    credentialsId: env.DOCKERHUB_CREDENTIALS,
                    usernameVariable: 'DOCKER_USER',
                    passwordVariable: 'DOCKER_PASS'
                )]) {
                    sh '''
                        echo "$DOCKER_PASS" | docker login -u "$DOCKER_USER" --password-stdin
                    '''
                    sh """
                        docker push "${env.IMAGE_FULL}"
                        docker push "${env.IMAGE_LATEST}"
                    """
                    sh 'docker logout'
                }
            }
        }
    }

    post {
        success {
            echo "Pipeline completado. Imagen publicada: ${env.IMAGE_FULL} y ${env.IMAGE_LATEST}"
        }
        failure {
            echo "Pipeline falló en el build #${env.BUILD_NUMBER}. Revisa los logs de las stages."
        }
        unstable {
            echo "Pipeline inestable en el build #${env.BUILD_NUMBER}."
        }
        aborted {
            echo "Pipeline cancelado en el build #${env.BUILD_NUMBER}."
        }
        always {
            echo "Limpiando imágenes locales y recursos temporales..."
            sh """
                docker rmi -f "${env.IMAGE_FULL}" 2>/dev/null || true
                docker rmi -f "${env.IMAGE_LATEST}" 2>/dev/null || true
                docker image prune -f --filter "label=org.opencontainers.image.revision=${env.GIT_COMMIT}" || true
            """
            cleanWs()
        }
    }
}
